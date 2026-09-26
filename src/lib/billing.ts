import type { BillingCycle, LText, Locale, Plan } from "@/lib/types";
import { BILLING_CYCLES, PLANS } from "@/lib/types";

/**
 * The commercial layer: what a site costs, until when it is paid for, and how a payment link is produced.
 *
 * Three rules hold everything here together:
 *  1. **Money is fils.** 1 KWD = 1000 fils, and every amount in this file is an integer count of them.
 *     A currency with three decimal places and a float is a rounding bug waiting for the first invoice
 *     that ends in .005.
 *  2. **Dates are calendar days**, carried as `YYYY-MM-DD` strings and never as `Date`. `paid_until` means
 *     "the last day this site is paid for" in Kuwait, not an instant; turning it into a Date gives it a
 *     timezone it does not have, and a Vercel cron running in UTC then pauses a site three hours early.
 *     ISO date strings also compare correctly with `<`, which is the whole of the overdue test.
 *  3. **Nothing here touches the database or the network by default.** The numbers are data, the date
 *     arithmetic is pure, and the payment provider is an interface whose default implementation is the
 *     founder writing down a cash payment.
 */

/* ------------------------------------------------------------------ money */

export const FILS_PER_KWD = 1000;

/**
 * Parses a typed amount in KWD ("25", "25.5", "٢٥") into fils, without ever multiplying a float by 1000.
 * `25.13 * 1000` is 25129.999999999996; splitting on the decimal point and padding is exact.
 * Returns null for anything that is not a non-negative amount with at most three decimals.
 */
export function kwdToFils(input: string): number | null {
  // Arabic-Indic digits are what an Arabic keyboard produces; the form should not reject its own language.
  const normalized = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[,\s]/g, "");
  const m = /^(\d{1,7})(?:\.(\d{1,3}))?$/.exec(normalized);
  if (!m) return null;
  return Number(m[1]) * FILS_PER_KWD + Number((m[2] ?? "").padEnd(3, "0"));
}

/** Fils as a plain decimal string ("15", "15.500") — the value an <input> shows and posts back. */
export function filsToKwd(fils: number): string {
  const n = Math.max(0, Math.round(fils));
  const whole = Math.floor(n / FILS_PER_KWD);
  const rest = n % FILS_PER_KWD;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(3, "0")}`;
}

/** Display form with the currency, in the reader's language. Western digits: Kuwaiti invoices use them. */
export function formatFils(fils: number, locale: Locale = "ar"): string {
  const v = filsToKwd(fils);
  return locale === "ar" ? `${v} د.ك` : `KD ${v}`;
}

/* ------------------------------------------------------------------ the catalogue */

export interface PlanDefinition {
  plan: Plan;
  name: LText;
  /** One line under the name on the pricing page. */
  pitch: LText;
  /** Price per cycle, in fils. */
  price: Record<BillingCycle, number>;
  features: LText[];
  /** The tier the pricing page highlights. Exactly one plan carries it. */
  recommended?: boolean;
}

/**
 * Default prices, in fils.
 *
 * Annual is ten months for twelve, deliberately: at this end of the market most churn is not a decision,
 * it is a contractor who did not answer a payment message for three weeks. A year paid up front removes
 * eleven collection conversations and the site cannot lapse while he is busy on a job.
 */
const DEFAULT_PRICES: Record<Plan, Record<BillingCycle, number>> = {
  basic: { monthly: 15_000, yearly: 150_000 },
  pro: { monthly: 25_000, yearly: 250_000 },
  plus: { monthly: 40_000, yearly: 400_000 },
};

/** One-off charge for building the site: photos sorted, content written, domain and DNS set up. */
const DEFAULT_SETUP_FEE = 50_000;

/**
 * Prices are configurable without a deploy, because a price list belongs to the business and not to a
 * component. `BILLING_PRICES_FILS` is a JSON object of the same shape as DEFAULT_PRICES; anything missing
 * or malformed falls back to the default rather than to zero — a parse slip must never make the product free.
 */
function envPrices(): Record<Plan, Record<BillingCycle, number>> {
  const raw = process.env.BILLING_PRICES_FILS?.trim();
  if (!raw) return DEFAULT_PRICES;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<Plan, Partial<Record<BillingCycle, unknown>>>>;
    const out = {} as Record<Plan, Record<BillingCycle, number>>;
    for (const plan of PLANS) {
      out[plan] = { ...DEFAULT_PRICES[plan] };
      for (const cycle of BILLING_CYCLES) {
        const v = parsed?.[plan]?.[cycle];
        if (Number.isInteger(v) && (v as number) >= 0) out[plan][cycle] = v as number;
      }
    }
    return out;
  } catch {
    console.warn("[billing] BILLING_PRICES_FILS is not valid JSON — using the default price list");
    return DEFAULT_PRICES;
  }
}

export function setupFeeFils(): number {
  const raw = Number(process.env.BILLING_SETUP_FEE_FILS);
  return Number.isInteger(raw) && raw >= 0 ? raw : DEFAULT_SETUP_FEE;
}

/** The setup fee is waived on a yearly prepayment. It is the lever that makes annual the obvious choice. */
export function setupFeeFor(cycle: BillingCycle): number {
  return cycle === "yearly" ? 0 : setupFeeFils();
}

const PLAN_COPY: Record<Plan, Omit<PlanDefinition, "plan" | "price">> = {
  basic: {
    name: { ar: "الأساسية", en: "Basic" },
    pitch: { ar: "وجود إلكتروني نظيف بدل صفحة إنستغرام", en: "A clean web presence instead of an Instagram page" },
    features: [
      { ar: "موقع كامل بقالب جاهز من أربعة أقسام", en: "A complete site on a ready template" },
      { ar: "عنوان فرعي مجاني (اسمك.decokuwait.com)", en: "Free subdomain (yourname.decokuwait.com)" },
      { ar: "عربي مع نسخة إنجليزية", en: "Arabic with an English version" },
      { ar: "زر واتساب مباشر على كل صفحة", en: "A direct WhatsApp button on every page" },
      { ar: "حتى ١٢ مشروعاً في المعرض", en: "Up to 12 portfolio projects" },
      { ar: "لوحة تحكم تُدار من الجوال", en: "An admin panel you run from your phone" },
    ],
  },
  pro: {
    name: { ar: "الاحترافية", en: "Pro" },
    pitch: { ar: "الأنسب لمقاول ديكور يعمل بشكل يومي", en: "The right fit for a decor contractor working every day" },
    recommended: true,
    features: [
      { ar: "كل ما في الأساسية", en: "Everything in Basic" },
      { ar: "نطاقك الخاص (yourcompany.com)", en: "Your own domain (yourcompany.com)" },
      { ar: "مشاريع بلا حد، ولكل مشروع صفحته الخاصة", en: "Unlimited projects, each with its own page" },
      { ar: "قبل وبعد بمقارنة تفاعلية، ومراحل التنفيذ يوماً بيوم", en: "Interactive before/after, and day-by-day progress" },
      { ar: "صفحات خدمات منفصلة تظهر في البحث", en: "Separate service pages that can rank in search" },
      { ar: "رقم زائر من ٦ أرقام يصلك في أول رسالة واتساب", en: "A 6-digit visitor id that arrives in the first WhatsApp message" },
      { ar: "تغيير المحتوى والصور وقت ما تحب", en: "Change content and photos whenever you like" },
    ],
  },
  plus: {
    name: { ar: "المتقدمة", en: "Plus" },
    pitch: { ar: "لمن يصرف على إعلانات ويريد أن يعرف أين ذهبت", en: "For those spending on ads who want to know where it went" },
    features: [
      { ar: "كل ما في الاحترافية", en: "Everything in Pro" },
      { ar: "ربط حسابات الإعلانات (ميتا، تيك توك، سناب شات، جوجل، إكس)", en: "Ad account connections (Meta, TikTok, Snapchat, Google, X)" },
      { ar: "إرسال مراحل العميل إلى المنصة التي جاء منها", en: "Customer stages sent back to the platform he came from" },
      { ar: "متابعة الزوار ومراحلهم من لوحة التحكم", en: "Visitor and stage tracking from the admin panel" },
      { ar: "أولوية في الرد والتعديلات", en: "Priority on replies and edits" },
    ],
  },
};

export function planCatalog(): PlanDefinition[] {
  const prices = envPrices();
  return PLANS.map((plan) => ({ plan, price: prices[plan], ...PLAN_COPY[plan] }));
}

export function planDefinition(plan: Plan): PlanDefinition {
  return { plan, price: envPrices()[plan], ...PLAN_COPY[plan] };
}

export function planPriceFils(plan: Plan, cycle: BillingCycle): number {
  return envPrices()[plan][cycle];
}

export function planLabel(plan: Plan, locale: Locale): string {
  return PLAN_COPY[plan].name[locale];
}

export function cycleLabel(cycle: BillingCycle, locale: Locale): string {
  const l: Record<BillingCycle, LText> = {
    monthly: { ar: "شهري", en: "Monthly" },
    yearly: { ar: "سنوي", en: "Yearly" },
  };
  return l[cycle][locale];
}

export function isPlan(v: unknown): v is Plan {
  return typeof v === "string" && (PLANS as string[]).includes(v);
}
export function isBillingCycle(v: unknown): v is BillingCycle {
  return typeof v === "string" && (BILLING_CYCLES as string[]).includes(v);
}

/** How many months one cycle buys. The only place the two cycles differ arithmetically. */
export function cycleMonths(cycle: BillingCycle): number {
  return cycle === "yearly" ? 12 : 1;
}

/** Nominal length of a term in days — used only to spread a proration, never to compute an expiry date. */
export function cycleDays(cycle: BillingCycle): number {
  return cycle === "yearly" ? 365 : 30;
}

/** What a first invoice comes to: one term plus the setup fee, if the cycle carries one. */
export function firstInvoiceFils(plan: Plan, cycle: BillingCycle): number {
  return planPriceFils(plan, cycle) + setupFeeFor(cycle);
}

/** What the yearly price saves against paying monthly for twelve months, in fils. Zero when it saves nothing. */
export function yearlySavingFils(plan: Plan): number {
  return Math.max(0, planPriceFils(plan, "monthly") * 12 - planPriceFils(plan, "yearly"));
}

/* ------------------------------------------------------------------ calendar arithmetic */

/**
 * Kuwait is UTC+3 all year — no daylight saving — so the local calendar day is the UTC instant shifted
 * three hours. A cron firing at 00:30 UTC is 03:30 in Kuwait on the *same* day, but one firing at 22:00 UTC
 * is already tomorrow there, and "is this site overdue" must agree with the calendar on the customer's wall.
 */
const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000;

export function todayIso(now: Date = new Date()): string {
  return new Date(now.getTime() + KUWAIT_OFFSET_MS).toISOString().slice(0, 10);
}

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toUtcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromUtcMs(toUtcMs(iso) + days * 86_400_000);
}

/**
 * Adds whole months, clamping the day to the end of the target month: 31 January + 1 month is 28 February,
 * not 3 March. `Date.setMonth` overflows instead, which would silently hand a customer two extra days every
 * time his renewal date fell on the 31st.
 */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

/** Whole days from `a` to `b`; negative when `b` is earlier. Both are calendar days, so this is exact. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/**
 * The new `paid_until` after a payment lands.
 *
 * A renewal paid early extends from the existing expiry, not from today: a customer who pays a week before
 * his year ends must not lose that week for being punctual. A renewal paid late extends from today, because
 * the site was already off and back-dating the term would sell him days he never had. `paid_until` is the
 * last paid day, so a term starting today ends on today + n months, and a same-day expiry is still valid.
 */
export function nextPaidUntil(current: string | null, cycle: BillingCycle, today: string = todayIso()): string {
  const base = current && isIsoDate(current) && current >= today ? current : today;
  return addMonths(base, cycleMonths(cycle));
}

export type BillingState = "unsold" | "active" | "expiring" | "overdue";

export interface BillingStatus {
  state: BillingState;
  /** Days until `paidUntil` (0 = last paid day is today). Negative once overdue. null when never sold. */
  daysLeft: number | null;
  daysOverdue: number;
}

/** Days before expiry at which the panel starts showing amber and the cron starts sending reminders. */
export const EXPIRY_WARNING_DAYS = 14;

export function billingStatus(paidUntil: string | null, today: string = todayIso(), warnDays = EXPIRY_WARNING_DAYS): BillingStatus {
  if (!paidUntil || !isIsoDate(paidUntil)) return { state: "unsold", daysLeft: null, daysOverdue: 0 };
  const daysLeft = daysBetween(today, paidUntil);
  if (daysLeft < 0) return { state: "overdue", daysLeft, daysOverdue: -daysLeft };
  return { state: daysLeft <= warnDays ? "expiring" : "active", daysLeft, daysOverdue: 0 };
}

/** The single source of truth for "this subscription has lapsed". Matches `listSitesDueForPause()`'s SQL. */
export function isOverdue(paidUntil: string | null, today: string = todayIso()): boolean {
  return !!paidUntil && isIsoDate(paidUntil) && paidUntil < today;
}

/**
 * When a renewal message goes out: a fortnight ahead, a week ahead, on the last paid day, and three days
 * after it lapsed. Expressed as days *remaining*, so T+3 is -3. The last one exists because the site is
 * already dark by then and that is the message people actually answer.
 */
export const REMINDER_OFFSETS = [14, 7, 0, -3] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

/** The reminder due for this site today, or null. Exact match: a reminder is sent once, on its own day. */
export function reminderOffsetFor(paidUntil: string | null, today: string = todayIso()): ReminderOffset | null {
  if (!paidUntil || !isIsoDate(paidUntil)) return null;
  const daysLeft = daysBetween(today, paidUntil);
  return REMINDER_OFFSETS.find((o) => o === daysLeft) ?? null;
}

export interface Proration {
  /** Unused days remaining on the current term. */
  remainingDays: number;
  /** What the upgrade costs today, in fils. Zero for a sideways or downward move. */
  amountFils: number;
}

/**
 * Cost of moving to a more expensive plan in the middle of a paid term: the price difference for the days
 * that are left, and nothing for a downgrade. A downgrade takes effect at renewal instead of refunding —
 * refunds on KNET are a manual reversal the founder does not want to run monthly, and nobody at this end of
 * the market expects one. `paid_until` is unchanged either way; only the rate changes.
 */
export function prorateUpgrade(args: {
  fromPlan: Plan;
  toPlan: Plan;
  cycle: BillingCycle;
  paidUntil: string | null;
  today?: string;
}): Proration {
  const today = args.today ?? todayIso();
  const term = cycleDays(args.cycle);
  const remainingDays = Math.min(term, Math.max(0, args.paidUntil && isIsoDate(args.paidUntil) ? daysBetween(today, args.paidUntil) : 0));
  const delta = planPriceFils(args.toPlan, args.cycle) - planPriceFils(args.fromPlan, args.cycle);
  if (delta <= 0 || remainingDays === 0) return { remainingDays, amountFils: 0 };
  return { remainingDays, amountFils: Math.round((delta * remainingDays) / term) };
}

/* ------------------------------------------------------------------ payments */

export type PaymentMode = "manual" | "myfatoorah";

/**
 * How a payment link is produced.
 *
 * `manual` is the default and works with no credentials at all: the founder takes cash or a KNET transfer,
 * records the reference here and the site's `paid_until` moves. `myfatoorah` activates on its own the moment
 * `MYFATOORAH_API_KEY` is set. MyFatoorah is the right rail for Kuwait — KNET, cards and Apple Pay at
 * 2.0–2.75% per transaction with no setup or monthly fee — but the product must be sellable before the
 * merchant account exists, so nothing here is a hard dependency and no package was added for it.
 *
 * Cheques are deliberately not a mode. A post-dated cheque in this trade is a collection problem with a
 * date on it.
 */
export function paymentMode(): PaymentMode {
  return process.env.MYFATOORAH_API_KEY?.trim() ? "myfatoorah" : "manual";
}

export interface InvoiceRequest {
  siteId: string;
  /** Shown to the customer on the payment page. */
  customerName: string;
  plan: Plan;
  cycle: BillingCycle;
  amountFils: number;
  /** WhatsApp number in international form without "+", used by MyFatoorah to send the link itself. */
  whatsapp?: string | null;
  locale?: Locale;
  /** Where MyFatoorah returns the payer. Absolute URLs; omitted in manual mode. */
  callbackUrl?: string;
  errorUrl?: string;
}

export interface InvoiceResult {
  ok: boolean;
  mode: PaymentMode;
  /** What goes into `sites.last_invoice_ref` — a MyFatoorah invoice id, or a locally minted cash reference. */
  reference: string;
  /** The link to paste into WhatsApp. Null in manual mode: there is nothing to pay online. */
  url: string | null;
  /** Error *code*, never a provider sentence: it is rendered in the panel's own error banner. */
  error?: string;
}

/** `DK-260922-4F2A` — short enough to read down a phone, unique enough to find in a year of messages. */
export function mintReference(prefix: string, now: Date = new Date(), rand = () => Math.random()): string {
  const d = todayIso(now).slice(2).replace(/-/g, "");
  const tail = Math.floor(rand() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
  return `${prefix}-${d}-${tail}`;
}

/**
 * Base URL of the MyFatoorah API. Kuwaiti live accounts are on the KW host; the sandbox is a different
 * host entirely, so it is a separate switch rather than a flag on the same URL.
 */
function myFatoorahBase(): string {
  const explicit = process.env.MYFATOORAH_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return process.env.MYFATOORAH_TEST === "true" ? "https://apitest.myfatoorah.com" : "https://api-kw.myfatoorah.com";
}

/**
 * Whether a string is a payment link this product could have produced.
 *
 * The generated link travels back to the panel in the URL, and the panel renders it as something the
 * operator is invited to click and forward to a paying customer. An unchecked URL there is a ready-made
 * phishing vector on a page the operator trusts — the same reason `superError` refuses unknown error codes.
 * So it must be https and on the configured provider's domain, and nothing else is ever rendered.
 */
export function isPaymentUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const allowed = new URL(myFatoorahBase()).hostname.toLowerCase();
    const host = u.hostname.toLowerCase();
    return host === allowed || host.endsWith(".myfatoorah.com") || host === "myfatoorah.com";
  } catch {
    return false;
  }
}

async function sendPaymentLink(req: InvoiceRequest): Promise<InvoiceResult> {
  const key = process.env.MYFATOORAH_API_KEY!.trim();
  const reference = mintReference("DK");
  const body = {
    // LNK returns a payable link instead of sending an SMS: the founder pastes it into the WhatsApp thread
    // he is already having with the customer, which is where this conversation actually happens.
    NotificationOption: "LNK",
    CustomerName: req.customerName.slice(0, 100),
    DisplayCurrencyIso: "KWD",
    InvoiceValue: Number(filsToKwd(req.amountFils)),
    CustomerReference: reference,
    UserDefinedField: req.siteId,
    Language: (req.locale ?? "ar") === "ar" ? "ar" : "en",
    ...(req.whatsapp ? { CustomerMobile: req.whatsapp.replace(/\D/g, "").slice(-8), MobileCountryCode: "+965" } : {}),
    ...(req.callbackUrl ? { CallBackUrl: req.callbackUrl } : {}),
    ...(req.errorUrl ? { ErrorUrl: req.errorUrl } : {}),
  };
  try {
    const res = await fetch(`${myFatoorahBase()}/v2/SendPayment`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      // A payment link is generated while an operator watches a spinner; it must fail fast, not hang.
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await res.json().catch(() => null)) as
      | { IsSuccess?: boolean; Message?: string; Data?: { InvoiceId?: number; InvoiceURL?: string } }
      | null;
    if (!res.ok || !json?.IsSuccess || !json.Data?.InvoiceURL) {
      // The provider's message goes to the log, where an operator can read it; the panel gets a code.
      console.error(`[billing] myfatoorah SendPayment failed status=${res.status} message=${json?.Message ?? "none"}`);
      return { ok: false, mode: "myfatoorah", reference, url: null, error: "payment_provider_failed" };
    }
    return { ok: true, mode: "myfatoorah", reference: json.Data.InvoiceId ? `MF-${json.Data.InvoiceId}` : reference, url: json.Data.InvoiceURL };
  } catch (e) {
    console.error("[billing] myfatoorah SendPayment unreachable:", e);
    return { ok: false, mode: "myfatoorah", reference, url: null, error: "payment_provider_unreachable" };
  }
}

/**
 * Produces a payment reference, and a link when a provider is configured.
 *
 * In manual mode this is not a failure: it returns a cash reference the founder writes on the receipt and
 * types back into the panel, which is exactly how this trade already pays for things.
 */
export async function createInvoice(req: InvoiceRequest): Promise<InvoiceResult> {
  if (!Number.isInteger(req.amountFils) || req.amountFils <= 0) {
    return { ok: false, mode: paymentMode(), reference: "", url: null, error: "invalid_amount" };
  }
  if (paymentMode() === "myfatoorah") return sendPaymentLink(req);
  return { ok: true, mode: "manual", reference: mintReference("CASH"), url: null };
}
