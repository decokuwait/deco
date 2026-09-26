"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/site-request";
import { reportError } from "@/lib/observability";
import { readStr } from "@/components/admin/ui";
import { createLead, normalizeWhatsapp } from "./_lib/leads";

/**
 * The "اطلب موقعك" form on `/` and `/pricing`.
 *
 * This is the only unauthenticated write the platform host accepts, so it is treated like one: the payload
 * is bounded field by field, the number is normalised before it is stored, a honeypot catches the form
 * fillers, and the caller is rate limited on the trusted client IP. A failure never shows the visitor a
 * stack trace — it comes back as a code the page knows how to say in Arabic.
 */

const BACK: Record<string, string> = { home: "/", pricing: "/pricing" };

function back(source: string, params: Record<string, string>): string {
  const path = BACK[source] ?? "/";
  return `${path}?${new URLSearchParams(params).toString()}#request`;
}

export async function submitLeadAction(fd: FormData) {
  const source = readStr(fd, "source", 16);
  const name = readStr(fd, "name", 80);
  const whatsapp = normalizeWhatsapp(readStr(fd, "whatsapp", 24));
  const trade = readStr(fd, "trade", 40);
  const area = readStr(fd, "area", 40);
  const message = readStr(fd, "message", 1000);
  const plan = readStr(fd, "plan", 16);

  // A bot that fills every input it finds trips this; a person never sees the field. Answered with the
  // same success page as a real submission, because telling a spammer why he failed is free tuning for him.
  if (readStr(fd, "company_website", 200)) redirect(back(source, { sent: "1" }));

  if (name.length < 2) redirect(back(source, { error: "invalid_name" }));
  if (!whatsapp) redirect(back(source, { error: "invalid_whatsapp" }));

  const ip = clientIp(await headers()) || "unknown";
  // Five in an hour is far more than anyone legitimately needs and low enough that a flood is pointless.
  if (!(await rateLimit(`lead:${ip}`, 5, 3600))) redirect(back(source, { error: "rate_limited" }));

  try {
    await createLead({ name, whatsapp, trade, area, message, source, plan });
  } catch (e) {
    // A lost lead is a lost customer, so this is never swallowed: it goes to the log (and Sentry when a DSN
    // is set) with the source, and the visitor is asked to try again rather than shown a success banner.
    await reportError(e, { source: "lead-form", fields: { formSource: source } });
    redirect(back(source, { error: "server_error" }));
  }
  redirect(back(source, { sent: "1" }));
}
