import type { EventKey, PixelConfig, Platform, Stage } from "@/lib/types";

export const EVENT_KEYS: EventKey[] = [
  "page_view",
  "whatsapp_click",
  "call_click",
  "contacted",
  "called_for_visit",
  "ordered",
  "first_payment",
  "order_complete",
];

export const EVENT_KEY_LABELS: Record<EventKey, { ar: string; en: string }> = {
  page_view: { ar: "زيارة صفحة", en: "Page view" },
  whatsapp_click: { ar: "نقرة واتساب", en: "WhatsApp click" },
  call_click: { ar: "نقرة اتصال", en: "Call click" },
  contacted: { ar: "تم التواصل", en: "Contacted" },
  called_for_visit: { ar: "تم طلب زيارة", en: "Called for visit" },
  ordered: { ar: "تم الطلب", en: "Ordered" },
  first_payment: { ar: "الدفعة الأولى", en: "First payment" },
  order_complete: { ar: "اكتمل الطلب", en: "Order complete" },
};

/** Default event names per platform. Standard events where a sensible one exists, custom otherwise. */
export const DEFAULT_EVENT_MAP: Record<Platform, Record<EventKey, string>> = {
  meta: {
    page_view: "PageView",
    whatsapp_click: "Contact",
    call_click: "Contact",
    contacted: "Lead",
    called_for_visit: "Schedule",
    ordered: "InitiateCheckout",
    first_payment: "Purchase",
    order_complete: "OrderComplete",
  },
  tiktok: {
    page_view: "ViewContent",
    whatsapp_click: "Contact",
    call_click: "Contact",
    contacted: "SubmitForm",
    called_for_visit: "Subscribe",
    ordered: "PlaceAnOrder",
    first_payment: "CompletePayment",
    order_complete: "CompleteRegistration",
  },
  snapchat: {
    page_view: "PAGE_VIEW",
    whatsapp_click: "CUSTOM_EVENT_1",
    call_click: "CUSTOM_EVENT_1",
    contacted: "SIGN_UP",
    called_for_visit: "RESERVE",
    ordered: "START_CHECKOUT",
    first_payment: "PURCHASE",
    order_complete: "CUSTOM_EVENT_2",
  },
  google: {
    page_view: "page_view",
    whatsapp_click: "contact",
    call_click: "contact",
    contacted: "generate_lead",
    called_for_visit: "schedule_visit",
    ordered: "begin_checkout",
    first_payment: "purchase",
    order_complete: "order_complete",
  },
  // X has no standard event names: every event is an Event ID created in X Events Manager
  // (e.g. tw-o8vjt-oa7ve). Empty = not configured -> the provider skips delivery for that event.
  x: {
    page_view: "",
    whatsapp_click: "",
    call_click: "",
    contacted: "",
    called_for_visit: "",
    ordered: "",
    first_payment: "",
    order_complete: "",
  },
};

export function resolveEventName(pixel: Pick<PixelConfig, "platform" | "eventMap">, key: EventKey): string {
  const custom = pixel.eventMap?.[key];
  if (custom && custom.trim()) return custom.trim();
  return DEFAULT_EVENT_MAP[pixel.platform][key];
}

export function stageToEventKey(stage: Stage): EventKey | null {
  if (stage === "new") return null;
  return stage;
}
