import type { ComponentType } from "react";
import type { StatsVariant, SectionProps } from "../../types";
import { StatsBand } from "./StatsBand";
import { StatsCards } from "./StatsCards";
import { StatsInline } from "./StatsInline";
import { StatsCircles } from "./StatsCircles";

export const STATS: Record<StatsVariant, ComponentType<SectionProps>> = {
  band: StatsBand,
  cards: StatsCards,
  inline: StatsInline,
  circles: StatsCircles,
};
