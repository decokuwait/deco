import type { Project } from "@/lib/types";
import type { RenderCtx } from "../../types";
import { cx } from "../../ui/primitives";

/** Title / location / description block used under project media. */
export function ProjectMeta({ ctx, project, className = "", light = false, compact = false }: { ctx: RenderCtx; project: Project; className?: string; light?: boolean; compact?: boolean }) {
  const loc = ctx.text(project.location);
  const desc = ctx.text(project.description);
  return (
    <div className={className}>
      <h3 className={cx("font-heading font-bold", compact ? "text-base" : "text-lg")}>{ctx.text(project.title)}</h3>
      {loc && <p className={cx("mt-1 text-xs font-semibold", light ? "text-accent" : "text-primary")}>{loc}</p>}
      {desc && !compact && <p className={cx("mt-2 text-sm", light ? "opacity-80" : "text-muted", "line-clamp-2")}>{desc}</p>}
    </div>
  );
}
