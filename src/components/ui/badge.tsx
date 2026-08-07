import type { HTMLAttributes } from "react";

export function Badge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`kh-badge ${className}`.trim()} {...props} />;
}
