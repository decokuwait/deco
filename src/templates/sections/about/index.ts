import type { ComponentType } from "react";
import type { AboutVariant, SectionProps } from "../../types";
import { AboutSplit } from "./AboutSplit";
import { AboutEditorial } from "./AboutEditorial";
import { AboutBand } from "./AboutBand";
import { AboutCards } from "./AboutCards";
import { AboutQuote } from "./AboutQuote";

export const ABOUT: Record<AboutVariant, ComponentType<SectionProps>> = {
  split: AboutSplit,
  editorial: AboutEditorial,
  band: AboutBand,
  cards: AboutCards,
  quote: AboutQuote,
};
