import type { ComponentType } from "react";
import type { FooterVariant, SectionProps } from "../../types";
import { FooterColumns } from "./FooterColumns";
import { FooterMinimal } from "./FooterMinimal";
import { FooterCentered } from "./FooterCentered";
import { FooterBig } from "./FooterBig";

export const FOOTER: Record<FooterVariant, ComponentType<SectionProps>> = {
  columns: FooterColumns,
  minimal: FooterMinimal,
  centered: FooterCentered,
  big: FooterBig,
};
