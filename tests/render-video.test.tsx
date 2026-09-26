import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Media, posterSrc } from "@/templates/ui/primitives";
import type { MediaItem } from "@/lib/types";

/**
 * The demo used to carry a video, so the `kind === "video"` branches were exercised by the pass over
 * the 60 templates. That video was a hotlink to a third-party test-asset host shipped inside customers'
 * portfolios, so it is gone — and the branch keeps a test here, on the primitive every gallery routes
 * through, with an uploaded-file URL nothing ever fetches.
 */
const video: MediaItem = { id: "v1", kind: "video", url: "/api/files/clip.mp4", posterUrl: null, role: "gallery", order: 0 };

describe("uploaded videos render", () => {
  it("renders a <video> for a video media item", () => {
    const html = renderToStaticMarkup(<Media item={video} alt="مشروع منجز — الجهراء" />);
    expect(html).toContain("<video");
    expect(html).toContain("/api/files/clip.mp4");
    expect(html).not.toContain("undefined");
  });

  it("renders an image for an image media item", () => {
    const html = renderToStaticMarkup(<Media item={{ ...video, kind: "image", url: "/api/files/shot.jpg" }} alt="مشروع منجز — الجهراء" />);
    expect(html).toContain("<img");
    expect(html).toContain('alt="مشروع منجز — الجهراء"');
  });

  it("asks a poster-less video for its first frame, and leaves one with a poster alone", () => {
    expect(posterSrc(video)).toBe("/api/files/clip.mp4#t=0.1");
    expect(posterSrc({ ...video, posterUrl: "/api/files/poster.jpg" })).toBe("/api/files/clip.mp4");
  });
});
