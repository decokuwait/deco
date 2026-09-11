import { notFound } from "next/navigation";

/** Any platform URL without a route ends in the platform 404 page (rendered inside the platform layout). */
export default function PlatformCatchAll() {
  notFound();
}
