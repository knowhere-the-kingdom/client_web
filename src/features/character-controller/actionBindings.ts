export type KeyboardActionBinding = Readonly<{
  id: string;
  primary: string;
  secondary: string;
}>;

export function normalizeActionKey(value: string) {
  if (value === "Space") return " ";
  if (value === "Ctrl") return "control";
  return value.toLowerCase();
}

export function resolveBoundKeyboardAction(bindings: readonly KeyboardActionBinding[], key: string): string | null {
  const normalized = normalizeActionKey(key);
  const match = bindings.find((binding) => [binding.primary, binding.secondary].some((value) => {
    if (value === "Unbound" || value === "Hardcoded" || value.startsWith("Double-tap") || value.startsWith("Mouse")) return false;
    return normalizeActionKey(value) === normalized;
  }));
  return match?.id ?? null;
}
