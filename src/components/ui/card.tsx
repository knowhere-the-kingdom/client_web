import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={`kh-card ${className}`.trim()} {...props} />;
}
