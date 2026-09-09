import type { ComponentType } from "react";
import type { CtaVariant, SectionProps } from "../../types";
import { CtaBand } from "./CtaBand";
import { CtaCard } from "./CtaCard";
import { CtaSplit } from "./CtaSplit";
import { CtaMinimal } from "./CtaMinimal";

export const CTA: Record<CtaVariant, ComponentType<SectionProps>> = {
  band: CtaBand,
  card: CtaCard,
  split: CtaSplit,
  minimal: CtaMinimal,
};
