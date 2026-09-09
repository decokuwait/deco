import type { ComponentType } from "react";
import type { ProcessVariant, SectionProps } from "../../types";
import { ProcessSteps } from "./ProcessSteps";
import { ProcessTimeline } from "./ProcessTimeline";
import { ProcessNumbers } from "./ProcessNumbers";
import { ProcessCards } from "./ProcessCards";

export const PROCESS: Record<ProcessVariant, ComponentType<SectionProps>> = {
  steps: ProcessSteps,
  timeline: ProcessTimeline,
  numbers: ProcessNumbers,
  cards: ProcessCards,
};
