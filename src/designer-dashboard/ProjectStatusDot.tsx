import { projectStatusPresentation, type ProjectStatus } from "./workspace-model.ts";

export function ProjectStatusDot({ status, compact = false }: Readonly<{ status: ProjectStatus; compact?: boolean }>) {
  const presentation = projectStatusPresentation[status];
  return <span className={`designer-status designer-status--${presentation.tone}`} aria-label={`Project status: ${presentation.label}`}>
    <span className="designer-status__dot" aria-hidden="true" />
    <span className={compact ? "sr-only" : "designer-status__label"}>{presentation.label}</span>
  </span>;
}
