import type { ComponentType } from "react";
import type { TestimonialsVariant, SectionProps } from "../../types";
import { TestimonialsCards } from "./TestimonialsCards";
import { TestimonialsCarousel } from "./TestimonialsCarousel";
import { TestimonialsQuoteWall } from "./TestimonialsQuoteWall";
import { TestimonialsSingle } from "./TestimonialsSingle";

export const TESTIMONIALS: Record<TestimonialsVariant, ComponentType<SectionProps>> = {
  cards: TestimonialsCards,
  carousel: TestimonialsCarousel,
  quotewall: TestimonialsQuoteWall,
  single: TestimonialsSingle,
};
