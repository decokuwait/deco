import type { ComponentType } from "react";
import type { FaqVariant, SectionProps } from "../../types";
import { FaqAccordion } from "./FaqAccordion";
import { FaqTwoCol } from "./FaqTwoCol";
import { FaqCards } from "./FaqCards";

export const FAQ: Record<FaqVariant, ComponentType<SectionProps>> = {
  accordion: FaqAccordion,
  twocol: FaqTwoCol,
  cards: FaqCards,
};
