import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addDays,
  addMonths,
  billingStatus,
  createInvoice,
  cycleDays,
  cycleMonths,
  daysBetween,
  filsToKwd,
  firstInvoiceFils,
  formatFils,
  isIsoDate,
  isPaymentUrl,
  kwdToFils,
  mintReference,
  nextPaidUntil,
  planCatalog,
  planPriceFils,
  prorateUpgrade,
  reminderOffsetFor,
  setupFeeFor,
  todayIso,
  yearlySavingFils,
} from "@/lib/billing";
import { bearerToken, sameSecret } from "@/app/api/cron/_lib/auth";
import { normalizeWhatsapp } from "@/app/(platform)/pricing/_lib/leads";

const ENV_KEYS = ["BILLING_PRICES_FILS", "BILLING_SETUP_FEE_FILS", "MYFATOORAH_API_KEY", "MYFATOORAH_TEST", "MYFATOORAH_BASE_URL"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.useRealTimers();
});

describe("money is fils", () => {
  it("parses typed dinars without ever multiplying a float", () => {
    expect(kwdToFils("15")).toBe(15000);
    expect(kwdToFils("15.5")).toBe(15500);
    expect(kwdToFils("15.500")).toBe(15500);
    // 25.13 * 1000 is 25129.999999999996 in IEEE 754; the string split is exact.
    expect(kwdToFils("25.13")).toBe(25130);
    expect(kwdToFils("0.001")).toBe(1);
    expect(kwdToFils(" 1,250.750 ")).toBe(1250750);
  });

  it("accepts Arabic-Indic digits, because an Arabic keyboard produces them", () => {
    expect(kwdToFils("٢٥")).toBe(25000);
    expect(kwdToFils("٢٥.٥٠٠")).toBe(25500);
  });

  it("refuses anything that is not a non-negative amount with at most three decimals", () => {
    for (const bad of ["", "-5", "abc", "15.5000", "1e3", "15.", ".5", "15 KD"]) expect(kwdToFils(bad)).toBeNull();
  });

  it("round-trips through the display form", () => {
    for (const fils of [0, 1, 999, 1000, 15000, 25130, 400000]) expect(kwdToFils(filsToKwd(fils))).toBe(fils);
    expect(filsToKwd(15000)).toBe("15");
    expect(filsToKwd(15500)).toBe("15.500");
    expect(filsToKwd(1)).toBe("0.001");
  });

  it("formats in both languages", () => {
    expect(formatFils(250000, "ar")).toBe("250 د.ك");
    expect(formatFils(250000, "en")).toBe("KD 250");
  });
});

describe("the price list", () => {
  it("uses the documented anchors and sells the annual plan", () => {
    expect(planPriceFils("basic", "monthly")).toBe(15_000);
    expect(planPriceFils("basic", "yearly")).toBe(150_000);
    expect(planPriceFils("pro", "monthly")).toBe(25_000);
    expect(planPriceFils("pro", "yearly")).toBe(250_000);
    expect(planPriceFils("plus", "monthly")).toBe(40_000);
    expect(planPriceFils("plus", "yearly")).toBe(400_000);
    // Ten months for twelve: the annual discount is what makes a year up front the obvious choice.
    expect(yearlySavingFils("pro")).toBe(50_000);
  });

  it("highlights exactly one plan, and it is Pro", () => {
    const recommended = planCatalog().filter((p) => p.recommended);
    expect(recommended.map((p) => p.plan)).toEqual(["pro"]);
  });

  it("waives the setup fee on a yearly prepayment and charges it monthly", () => {
    expect(setupFeeFor("yearly")).toBe(0);
    expect(setupFeeFor("monthly")).toBe(50_000);
    expect(firstInvoiceFils("pro", "yearly")).toBe(250_000);
    expect(firstInvoiceFils("pro", "monthly")).toBe(75_000);
  });

  it("takes an override from the environment, and ignores a malformed one rather than making the product free", () => {
    process.env.BILLING_PRICES_FILS = JSON.stringify({ pro: { yearly: 300_000 } });
    expect(planPriceFils("pro", "yearly")).toBe(300_000);
    expect(planPriceFils("pro", "monthly")).toBe(25_000); // untouched key keeps the default
    process.env.BILLING_PRICES_FILS = "{not json";
    expect(planPriceFils("pro", "yearly")).toBe(250_000);
    process.env.BILLING_PRICES_FILS = JSON.stringify({ pro: { yearly: -1 } });
    expect(planPriceFils("pro", "yearly")).toBe(250_000);
    process.env.BILLING_PRICES_FILS = JSON.stringify({ pro: { yearly: 12.5 } });
    expect(planPriceFils("pro", "yearly")).toBe(250_000);
  });

  it("counts a cycle in months and in nominal days", () => {
    expect(cycleMonths("yearly")).toBe(12);
    expect(cycleMonths("monthly")).toBe(1);
    expect(cycleDays("yearly")).toBe(365);
    expect(cycleDays("monthly")).toBe(30);
  });
});

describe("calendar arithmetic", () => {
  it("validates ISO dates, including the month length", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true); // leap year
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-00-10")).toBe(false);
    expect(isIsoDate("26-01-01")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it("clamps the day when adding months instead of overflowing into the next one", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-03-31", 1)).toBe("2026-04-30");
    expect(addMonths("2026-01-15", 12)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-12-31", 1)).toBe("2027-01-31");
  });

  it("counts whole days across month, year and leap boundaries", () => {
    expect(daysBetween("2026-01-01", "2026-01-02")).toBe(1);
    expect(daysBetween("2026-01-02", "2026-01-01")).toBe(-1);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2); // leap day
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("reads today from the Kuwait calendar, not from UTC", () => {
    // 22:00 UTC is already the next day in Kuwait (UTC+3). A cron scheduled late in the UTC day must not
    // decide a Kuwaiti customer's last paid day ended a day early — or late.
    expect(todayIso(new Date("2026-09-22T22:00:00Z"))).toBe("2026-09-23");
    expect(todayIso(new Date("2026-09-22T20:59:59Z"))).toBe("2026-09-22");
    expect(todayIso(new Date("2026-09-22T00:00:00Z"))).toBe("2026-09-22");
  });
});

describe("renewal", () => {
  it("extends from the existing expiry when the customer pays early", () => {
    // Paid until March 10, pays on March 3: he keeps the week he paid for.
    expect(nextPaidUntil("2026-03-10", "yearly", "2026-03-03")).toBe("2027-03-10");
    expect(nextPaidUntil("2026-03-10", "monthly", "2026-03-03")).toBe("2026-04-10");
  });

  it("extends from today when the subscription already lapsed", () => {
    // The site was off for a month; back-dating would sell him days he never had.
    expect(nextPaidUntil("2026-01-10", "yearly", "2026-03-03")).toBe("2027-03-03");
  });

  it("treats the expiry day itself as still paid", () => {
    expect(nextPaidUntil("2026-03-03", "monthly", "2026-03-03")).toBe("2026-04-03");
  });

  it("starts from today for a site that was never sold, and survives a junk stored value", () => {
    expect(nextPaidUntil(null, "yearly", "2026-03-03")).toBe("2027-03-03");
    expect(nextPaidUntil("not-a-date", "yearly", "2026-03-03")).toBe("2027-03-03");
  });

  it("keeps the anniversary stable over repeated yearly renewals", () => {
    let date = "2028-02-29"; // a leap-day anniversary
    date = nextPaidUntil(date, "yearly", "2028-02-01");
    expect(date).toBe("2029-02-28"); // clamped, not overflowed to March 1
    date = nextPaidUntil(date, "yearly", "2029-02-01");
    expect(date).toBe("2030-02-28");
  });
});

describe("overdue detection", () => {
  it("names the four states", () => {
    expect(billingStatus(null, "2026-03-03").state).toBe("unsold");
    expect(billingStatus("2026-06-01", "2026-03-03").state).toBe("active");
    expect(billingStatus("2026-03-10", "2026-03-03").state).toBe("expiring");
    expect(billingStatus("2026-03-02", "2026-03-03").state).toBe("overdue");
  });

  it("counts the last paid day as still inside the subscription", () => {
    const s = billingStatus("2026-03-03", "2026-03-03");
    expect(s.state).toBe("expiring");
    expect(s.daysLeft).toBe(0);
    expect(s.daysOverdue).toBe(0);
  });

  it("reports how far past due a lapsed site is", () => {
    const s = billingStatus("2026-02-25", "2026-03-03");
    expect(s.state).toBe("overdue");
    expect(s.daysOverdue).toBe(6);
    expect(s.daysLeft).toBe(-6);
  });
});

describe("renewal reminders", () => {
  it("fires on exactly T-14, T-7, T-0 and T+3 and on no other day", () => {
    const paidUntil = "2026-03-20";
    expect(reminderOffsetFor(paidUntil, "2026-03-06")).toBe(14);
    expect(reminderOffsetFor(paidUntil, "2026-03-13")).toBe(7);
    expect(reminderOffsetFor(paidUntil, "2026-03-20")).toBe(0);
    expect(reminderOffsetFor(paidUntil, "2026-03-23")).toBe(-3);
    for (const day of ["2026-03-05", "2026-03-12", "2026-03-19", "2026-03-21", "2026-03-24"]) {
      expect(reminderOffsetFor(paidUntil, day)).toBeNull();
    }
  });

  it("never fires for a site that was never sold", () => {
    expect(reminderOffsetFor(null, "2026-03-06")).toBeNull();
  });
});

describe("proration", () => {
  it("charges the price difference for the days that are left", () => {
    // Basic -> Pro yearly, 100 of 365 days remaining: (250000 - 150000) * 100 / 365.
    const p = prorateUpgrade({ fromPlan: "basic", toPlan: "pro", cycle: "yearly", paidUntil: "2026-06-11", today: "2026-03-03" });
    expect(p.remainingDays).toBe(100);
    expect(p.amountFils).toBe(Math.round((100_000 * 100) / 365));
  });

  it("charges nothing for a downgrade or a sideways move — the new rate applies at renewal", () => {
    expect(prorateUpgrade({ fromPlan: "plus", toPlan: "basic", cycle: "yearly", paidUntil: "2026-06-11", today: "2026-03-03" }).amountFils).toBe(0);
    expect(prorateUpgrade({ fromPlan: "pro", toPlan: "pro", cycle: "yearly", paidUntil: "2026-06-11", today: "2026-03-03" }).amountFils).toBe(0);
  });

  it("charges nothing when the term has already lapsed or was never sold", () => {
    expect(prorateUpgrade({ fromPlan: "basic", toPlan: "plus", cycle: "yearly", paidUntil: "2026-01-01", today: "2026-03-03" }).amountFils).toBe(0);
    expect(prorateUpgrade({ fromPlan: "basic", toPlan: "plus", cycle: "yearly", paidUntil: null, today: "2026-03-03" }).amountFils).toBe(0);
  });

  it("never charges more than a full term's difference, whatever the stored expiry says", () => {
    const p = prorateUpgrade({ fromPlan: "basic", toPlan: "plus", cycle: "monthly", paidUntil: "2030-01-01", today: "2026-03-03" });
    expect(p.remainingDays).toBe(30);
    expect(p.amountFils).toBe(25_000); // the full monthly difference, not four years of it
  });

  it("returns whole fils, never a fraction", () => {
    const p = prorateUpgrade({ fromPlan: "basic", toPlan: "pro", cycle: "yearly", paidUntil: "2026-03-10", today: "2026-03-03" });
    expect(Number.isInteger(p.amountFils)).toBe(true);
  });
});

describe("payments", () => {
  it("defaults to manual mode with no credentials and mints a cash reference instead of failing", async () => {
    const r = await createInvoice({ siteId: "s1", customerName: "Demo", plan: "pro", cycle: "yearly", amountFils: 250_000 });
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("manual");
    expect(r.url).toBeNull();
    expect(r.reference).toMatch(/^CASH-\d{6}-[0-9A-F]{4}$/);
  });

  it("refuses a zero or fractional amount before touching any provider", async () => {
    for (const amountFils of [0, -1, 12.5]) {
      const r = await createInvoice({ siteId: "s1", customerName: "Demo", plan: "pro", cycle: "yearly", amountFils });
      expect(r.ok).toBe(false);
      expect(r.error).toBe("invalid_amount");
    }
  });

  it("switches to MyFatoorah the moment the key is set, and returns the invoice link", async () => {
    process.env.MYFATOORAH_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ IsSuccess: true, Data: { InvoiceId: 987654, InvoiceURL: "https://kw.myfatoorah.com/KWT/ie/010" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = await createInvoice({ siteId: "s1", customerName: "شركة الديكور", plan: "pro", cycle: "yearly", amountFils: 250_000, whatsapp: "96550001111" });
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("myfatoorah");
    expect(r.reference).toBe("MF-987654");
    expect(r.url).toBe("https://kw.myfatoorah.com/KWT/ie/010");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api-kw.myfatoorah.com/v2/SendPayment");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(init.body)) as { InvoiceValue: number; DisplayCurrencyIso: string; CustomerMobile: string };
    expect(body.InvoiceValue).toBe(250);
    expect(body.DisplayCurrencyIso).toBe("KWD");
    expect(body.CustomerMobile).toBe("50001111");
    fetchMock.mockRestore();
  });

  it("reports a provider refusal as a code and never as the provider's own sentence", async () => {
    process.env.MYFATOORAH_API_KEY = "test-key";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ IsSuccess: false, Message: "Invalid token" }), { status: 401, headers: { "content-type": "application/json" } }));
    const r = await createInvoice({ siteId: "s1", customerName: "Demo", plan: "pro", cycle: "yearly", amountFils: 250_000 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("payment_provider_failed");
    expect(r.url).toBeNull();
    fetchMock.mockRestore();
  });

  it("only ever renders a payment URL on the provider's own https domain", () => {
    expect(isPaymentUrl("https://kw.myfatoorah.com/KWT/ie/010")).toBe(true);
    expect(isPaymentUrl("https://api-kw.myfatoorah.com/v2/x")).toBe(true);
    expect(isPaymentUrl("http://kw.myfatoorah.com/KWT/ie/010")).toBe(false);
    expect(isPaymentUrl("https://myfatoorah.com.evil.example/pay")).toBe(false);
    expect(isPaymentUrl("https://evil.example/pay")).toBe(false);
    expect(isPaymentUrl("javascript:alert(1)")).toBe(false);
    expect(isPaymentUrl("not a url")).toBe(false);
  });

  it("mints a readable, dated reference", () => {
    expect(mintReference("DK", new Date("2026-09-22T09:00:00Z"), () => 0.5)).toBe("DK-260922-7FFF");
  });
});

describe("cron authorisation", () => {
  it("compares secrets without leaking their length or content through timing", () => {
    expect(sameSecret("s3cret", "s3cret")).toBe(true);
    expect(sameSecret("s3cret", "s3crft")).toBe(false);
    // Different lengths must answer false, not throw: timingSafeEqual on raw buffers would.
    expect(sameSecret("short", "a-much-longer-secret")).toBe(false);
    expect(sameSecret("", "")).toBe(true);
  });

  it("reads the bearer token case-insensitively and ignores anything else", () => {
    const req = (authorization?: string) =>
      ({ headers: new Headers(authorization ? { authorization } : {}) }) as unknown as Parameters<typeof bearerToken>[0];
    expect(bearerToken(req("Bearer abc123"))).toBe("abc123");
    expect(bearerToken(req("bearer abc123"))).toBe("abc123");
    expect(bearerToken(req("  Bearer   abc123  "))).toBe("abc123");
    expect(bearerToken(req("Basic abc123"))).toBe("");
    expect(bearerToken(req())).toBe("");
  });
});

describe("lead phone numbers", () => {
  it("normalises every way a Kuwaiti number is typed into one WhatsApp-ready form", () => {
    expect(normalizeWhatsapp("50000000")).toBe("96550000000");
    expect(normalizeWhatsapp("5000 0000")).toBe("96550000000");
    expect(normalizeWhatsapp("+965 5000 0000")).toBe("96550000000");
    expect(normalizeWhatsapp("00965 50000000")).toBe("96550000000");
    expect(normalizeWhatsapp("٥٠٠٠٠٠٠٠")).toBe("96550000000");
  });

  it("refuses something that cannot be a phone number", () => {
    for (const bad of ["", "123", "abc", "5000000", "1".repeat(20)]) expect(normalizeWhatsapp(bad)).toBeNull();
  });
});
