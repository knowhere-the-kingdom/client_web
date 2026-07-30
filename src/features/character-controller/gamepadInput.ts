const standardGamepadButtons: Readonly<Record<string, number>> = {
  "south button": 0, a: 0,
  "east button": 1, b: 1,
  "west button": 2, x: 2,
  "north button": 3, y: 3,
  "left bumper": 4,
  "right bumper": 5,
  "left trigger": 6,
  "right trigger": 7,
  view: 8,
  menu: 9,
  start: 9,
  "left stick press": 10,
  "right stick press": 11,
  "d-pad up": 12,
  "d-pad down": 13,
  "d-pad left": 14,
  "d-pad right": 15,
};

export function normalizedGamepadBinding(value: string) {
  return value.replace(/\s*\(hold\)$/i, "").trim().toLowerCase();
}

export function standardGamepadButtonIndex(value: string) {
  return standardGamepadButtons[normalizedGamepadBinding(value)];
}

export function applyGamepadDeadzone(value: number, deadzone: number) {
  const threshold = Math.max(0, Math.min(0.95, deadzone));
  if (!Number.isFinite(value) || Math.abs(value) < threshold) return 0;
  return Math.sign(value) * ((Math.min(1, Math.abs(value)) - threshold) / (1 - threshold));
}

export function gamepadDirectionalAxisValue(binding: string | undefined, leftX: number, leftY: number) {
  switch (binding) {
    case "left stick up": return Math.max(0, -leftY);
    case "left stick down": return Math.max(0, leftY);
    case "left stick left": return Math.max(0, -leftX);
    case "left stick right": return Math.max(0, leftX);
    default: return 0;
  }
}
