import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren } from "react";

export function Panel({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`panel ${className}`.trim()} {...props} />;
}

export function PanelTitle({ children }: PropsWithChildren) {
  return <h1 className="panel-title">{children}</h1>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href?: string;
  };

export function Button({ className = "", href, children, ...props }: ButtonProps) {
  const buttonClass = `button ${className}`.trim();

  if (href) {
    return (
      <a className={buttonClass} href={href} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button className={buttonClass} {...props}>
      {children}
    </button>
  );
}
