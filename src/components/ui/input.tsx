import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...props }, ref) {
  return <input ref={ref} className={`kh-input ${className}`.trim()} {...props} />;
});
