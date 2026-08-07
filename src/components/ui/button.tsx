import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "default" | "sm" | "xs" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Readonly<{ variant?: ButtonVariant; size?: ButtonSize }>;

export function Button({ className = "", variant = "default", size = "default", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`kh-button kh-button-${variant} kh-button-${size} ${className}`.trim()} {...props} />;
}
