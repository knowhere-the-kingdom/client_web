import {
  defaultLayoutGrid,
  screenStudioPageRecords,
  type PageRecord,
  type PermissionGate,
  type ScreenPageTemplate,
  type ScreenStatus,
} from "./screen-studio-model.ts";

export const SCREEN_STUDIO_CREATE_CAPABILITIES = [
  "world.designer.read",
  "admin.dashboard.read",
] as const;
export type ScreenStudioCreateCapability =
  (typeof SCREEN_STUDIO_CREATE_CAPABILITIES)[number];
export type ScreenStudioCreateInput = Readonly<{
  name: string;
  id: string;
  template: ScreenPageTemplate;
  runtimeMode: "hud" | "page";
  status: ScreenStatus;
  requiredCapability: ScreenStudioCreateCapability | "none";
  kind?: "Screen" | "Element" | "Panel" | "Page";
  elementType?: string;
  panelType?: string;
  width?: number;
  height?: number;
  label?: string;
  text?: string;
  color?: string;
  background?: string;
  borderRadius?: number;
  padding?: number;
  columns?: number;
}>;
export type ScreenStudioCreateValidation = Readonly<{
  valid: boolean;
  errors: Readonly<Record<string, string>>;
}>;

const idPattern = /^[a-z][a-z0-9-]{2,63}$/;

export type ScreenStudioDraftVisualFields = Readonly<{
  width: number;
  height: number;
  label: string;
  text: string;
  color: string;
  background: string;
  borderRadius: number;
  padding: number;
  columns: number;
}>;

export const defaultScreenStudioDraftVisualFields = (): ScreenStudioDraftVisualFields => ({
  width: 80,
  height: 32,
  label: "New element",
  text: "New content",
  color: "#17120d",
  background: "#f2c14e",
  borderRadius: 4,
  padding: 8,
  columns: 2,
});

export function validateScreenStudioVisualFields(fields: ScreenStudioDraftVisualFields): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};
  if (!Number.isFinite(fields.width) || fields.width < 8 || fields.width > 512) errors.width = "Width must be between 8 and 512 pixels.";
  if (!Number.isFinite(fields.height) || fields.height < 8 || fields.height > 512) errors.height = "Height must be between 8 and 512 pixels.";
  if (!fields.label.trim() && !fields.text.trim()) errors.content = "Provide a label or text value.";
  if (!/^#[0-9a-f]{6}$/i.test(fields.color)) errors.color = "Use a six-digit hex color.";
  if (!/^#[0-9a-f]{6}$/i.test(fields.background)) errors.background = "Use a six-digit hex color.";
  if (!Number.isInteger(fields.borderRadius) || fields.borderRadius < 0 || fields.borderRadius > 64) errors.borderRadius = "Radius must be 0 to 64 pixels.";
  if (!Number.isInteger(fields.padding) || fields.padding < 0 || fields.padding > 64) errors.padding = "Padding must be 0 to 64 pixels.";
  if (!Number.isInteger(fields.columns) || fields.columns < 1 || fields.columns > 12) errors.columns = "Columns must be between 1 and 12.";
  return errors;
}
export function validateScreenStudioCreate(
  input: ScreenStudioCreateInput,
  existing: readonly PageRecord[],
): ScreenStudioCreateValidation {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  const id = input.id.trim();
  if (name.length < 2 || name.length > 80)
    errors.name = "Use a screen name from 2 to 80 characters.";
  if (!idPattern.test(id))
    errors.id = "Use a stable lowercase ID with letters, numbers, and hyphens.";
  if (existing.some((page) => page.id === id))
    errors.id = "That draft ID is already in use.";
  if (
    existing.some(
      (page) => page.displayName.toLowerCase() === name.toLowerCase(),
    )
  )
    errors.name = "That screen name is already in use.";
  if (!screenStudioPageRecords.some((page) => page.template === input.template))
    errors.template = "Choose a canonical Page template.";
  if (input.runtimeMode !== "hud" && input.runtimeMode !== "page")
    errors.runtimeMode = "Choose HUD or Page.";
  if (
    input.requiredCapability !== "none" &&
    !SCREEN_STUDIO_CREATE_CAPABILITIES.includes(input.requiredCapability)
  )
    errors.requiredCapability = "Choose a known capability.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function createLocalScreenStudioPage(
  input: ScreenStudioCreateInput,
  existing: readonly PageRecord[],
): PageRecord | null {
  if (!validateScreenStudioCreate(input, existing).valid) return null;
  const template = screenStudioPageRecords.find(
    (page) => page.template === input.template,
  )!;
  const gate: PermissionGate | undefined =
    input.requiredCapability === "none"
      ? undefined
      : {
          id: `gate-${input.id}`,
          requiredCapability: input.requiredCapability,
          mode: "all",
          deniedMessage: `${input.requiredCapability} capability is required.`,
        };
  return {
    ...template,
    id: input.id.trim(),
    slug: input.id.trim(),
    displayName: input.name.trim(),
    description: "Local Screen Studio draft; persistence is disabled.",
    runtimeMode: input.runtimeMode,
    status: input.status,
    template: input.template,
    nodes: [],
    gate,
    grid: defaultLayoutGrid,
    revision: { revision: 1, lifecycle: "draft" },
    audit: {
      owner: "Creator",
      createdAt: "2026-08-04T00:00:00Z",
      updatedAt: "2026-08-04T00:00:00Z",
    },
  };
}
