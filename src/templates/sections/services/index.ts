import type { ComponentType } from "react";
import type { ServicesVariant, SectionProps } from "../../types";
import { ServicesGrid } from "./ServicesGrid";
import { ServicesList } from "./ServicesList";
import { ServicesBento } from "./ServicesBento";
import { ServicesZigzag } from "./ServicesZigzag";
import { ServicesIconRow } from "./ServicesIconRow";
import { ServicesTabs } from "./ServicesTabs";
import { ServicesCarousel } from "./ServicesCarousel";

export const SERVICES: Record<ServicesVariant, ComponentType<SectionProps>> = {
  grid: ServicesGrid,
  list: ServicesList,
  bento: ServicesBento,
  zigzag: ServicesZigzag,
  iconrow: ServicesIconRow,
  tabs: ServicesTabs,
  carousel: ServicesCarousel,
};
