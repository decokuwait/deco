import type { ComponentType } from "react";
import type { ContactVariant, SectionProps } from "../../types";
import { ContactSplit } from "./ContactSplit";
import { ContactCards } from "./ContactCards";
import { ContactMap } from "./ContactMap";
import { ContactInline } from "./ContactInline";

export const CONTACT: Record<ContactVariant, ComponentType<SectionProps>> = {
  split: ContactSplit,
  cards: ContactCards,
  map: ContactMap,
  inline: ContactInline,
};
