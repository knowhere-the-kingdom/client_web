import { useEffect, useId, useRef, type ReactNode } from "react";

import "./workspace-editor-overlay.css";

export function WorkspaceEditorOverlay({ open, title, onDismiss, onClose, children, className = "", dismissOnEscape = true, headerActions }: Readonly<{
  open: boolean;
  title: string;
  onDismiss: () => void;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  dismissOnEscape?: boolean;
  headerActions?: ReactNode;
}>) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !dismissOnEscape) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismissRef.current();
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => {
      window.removeEventListener("keydown", handleEscape, true);
    };
  }, [dismissOnEscape, open]);

  if (!open) return null;
  return <aside className={`workspace-editor-overlay${className ? ` ${className}` : ""}`} role="dialog" aria-modal="false" aria-labelledby={titleId}>
    <header className="workspace-editor-overlay__header">
      <h2 id={titleId}>{title}</h2>
      <div className="workspace-editor-overlay__header-actions">
        {headerActions}
        <button ref={closeRef} type="button" className="workspace-editor-overlay__close" onClick={onClose ?? onDismiss} aria-label={`Close ${title}`}>×</button>
      </div>
    </header>
    <div className="workspace-editor-overlay__content">{children}</div>
  </aside>;
}
