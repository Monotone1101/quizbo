import type { CSSProperties, ComponentProps } from "react";
import { cn } from "@/lib/utils";

type CornerSet = "all" | "diagonal" | "none";

/** The four `+` registration marks. Render inside any element that has the `blueprint` class. */
export function Corners({ set = "all", color }: { set?: CornerSet; color?: string }) {
  if (set === "none") return null;
  const positions = set === "all" ? (["tl", "tr", "bl", "br"] as const) : (["tl", "br"] as const);
  const style: CSSProperties | undefined = color ? { color } : undefined;
  return (
    <>
      {positions.map((position) => (
        <i key={position} className={`corner ${position}`} style={style} aria-hidden="true" />
      ))}
    </>
  );
}

/** A framed Industry object: hairline border, square corners, transparent fill, registration marks. */
export function Blueprint({
  corners = "all",
  cornerColor,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { corners?: CornerSet; cornerColor?: string }) {
  return (
    <div className={cn("blueprint", className)} {...props}>
      <Corners set={corners} color={cornerColor} />
      {children}
    </div>
  );
}
