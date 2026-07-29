import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type { ComponentPropsWithoutRef, PropsWithChildren } from "react";

type ScrollAreaProps = PropsWithChildren<ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>> & Readonly<{ contentClassName?: string; horizontal?: boolean }>;

export function ScrollArea({ children, className = "", contentClassName = "", horizontal = false, ...props }: ScrollAreaProps) {
  return <ScrollAreaPrimitive.Root className={`kh-scroll-area ${className}`.trim()} {...props}>
    <ScrollAreaPrimitive.Viewport className="kh-scroll-area-viewport"><div className={`kh-scroll-area-content ${contentClassName}`.trim()}>{children}</div></ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar className="kh-scrollbar" orientation="vertical"><ScrollAreaPrimitive.Thumb className="kh-scrollbar-thumb" /></ScrollAreaPrimitive.Scrollbar>
    {horizontal ? <ScrollAreaPrimitive.Scrollbar className="kh-scrollbar kh-scrollbar-horizontal" orientation="horizontal"><ScrollAreaPrimitive.Thumb className="kh-scrollbar-thumb" /></ScrollAreaPrimitive.Scrollbar> : null}
    <ScrollAreaPrimitive.Corner className="kh-scroll-corner" />
  </ScrollAreaPrimitive.Root>;
}
