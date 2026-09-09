import type { ComponentType } from "react";
import type { NavVariant, SectionProps } from "../../types";
import { NavClassic } from "./NavClassic";
import { NavCentered } from "./NavCentered";
import { NavSplit } from "./NavSplit";
import { NavMinimal } from "./NavMinimal";
import { NavPill } from "./NavPill";
import { NavTransparent } from "./NavTransparent";
import { NavBoxed } from "./NavBoxed";

export const NAV: Record<NavVariant, ComponentType<SectionProps>> = {
  classic: NavClassic,
  centered: NavCentered,
  split: NavSplit,
  minimal: NavMinimal,
  pill: NavPill,
  transparent: NavTransparent,
  boxed: NavBoxed,
};
