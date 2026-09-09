import type { ComponentType } from "react";
import type { HeroVariant, SectionProps } from "../../types";
import { HeroSplit } from "./HeroSplit";
import { HeroFullscreen } from "./HeroFullscreen";
import { HeroCentered } from "./HeroCentered";
import { HeroDiagonal } from "./HeroDiagonal";
import { HeroCards } from "./HeroCards";
import { HeroVideo } from "./HeroVideo";
import { HeroEditorial } from "./HeroEditorial";
import { HeroGallery } from "./HeroGallery";
import { HeroArch } from "./HeroArch";
import { HeroStacked } from "./HeroStacked";

export const HERO: Record<HeroVariant, ComponentType<SectionProps>> = {
  split: HeroSplit,
  fullscreen: HeroFullscreen,
  centered: HeroCentered,
  diagonal: HeroDiagonal,
  cards: HeroCards,
  video: HeroVideo,
  editorial: HeroEditorial,
  gallery: HeroGallery,
  arch: HeroArch,
  stacked: HeroStacked,
};
