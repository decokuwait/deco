import type { ComponentType } from "react";
import type { BeforeAfterVariant, FinishedVariant, ProgressVariant, SectionProps } from "../../types";
import { FinishedGrid } from "./FinishedGrid";
import { FinishedMasonry } from "./FinishedMasonry";
import { FinishedCarousel } from "./FinishedCarousel";
import { FinishedBento } from "./FinishedBento";
import { FinishedFilmstrip } from "./FinishedFilmstrip";
import { BeforeAfterSliderSection } from "./BeforeAfterSliderSection";
import { BeforeAfterSideBySide } from "./BeforeAfterSideBySide";
import { BeforeAfterTabs } from "./BeforeAfterTabs";
import { BeforeAfterHover } from "./BeforeAfterHover";
import { ProgressSlideshowSection } from "./ProgressSlideshowSection";
import { ProgressTimeline } from "./ProgressTimeline";
import { ProgressStepperSection } from "./ProgressStepperSection";
import { ProgressFilmstrip } from "./ProgressFilmstrip";

export const FINISHED: Record<FinishedVariant, ComponentType<SectionProps>> = {
  grid: FinishedGrid,
  masonry: FinishedMasonry,
  carousel: FinishedCarousel,
  bento: FinishedBento,
  filmstrip: FinishedFilmstrip,
};

export const BEFORE_AFTER: Record<BeforeAfterVariant, ComponentType<SectionProps>> = {
  slider: BeforeAfterSliderSection,
  sidebyside: BeforeAfterSideBySide,
  tabs: BeforeAfterTabs,
  hover: BeforeAfterHover,
};

export const PROGRESS: Record<ProgressVariant, ComponentType<SectionProps>> = {
  slideshow: ProgressSlideshowSection,
  timeline: ProgressTimeline,
  stepper: ProgressStepperSection,
  filmstrip: ProgressFilmstrip,
};
