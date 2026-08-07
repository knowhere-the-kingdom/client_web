export const GROUND_SPRINT_MAX_MULTIPLIER = 2.25;
export const FLIGHT_STANCE_MULTIPLIER = 1.7;
export const FLIGHT_SPRINT_MAX_MULTIPLIER = 5;

function boundedCharge(charge: number) {
  return Math.max(0, Math.min(1, Number.isFinite(charge) ? charge : 0));
}

/** Ground sprint is quick; flight sprint uses a bounded exponential travel curve. */
export function sprintSpeedMultiplier(charge: number, flying: boolean, skillMultiplier = 1): number {
  const bounded = boundedCharge(charge);
  const skill = Math.max(0.1, Number.isFinite(skillMultiplier) ? skillMultiplier : 1);
  const maximum = (flying ? FLIGHT_SPRINT_MAX_MULTIPLIER : GROUND_SPRINT_MAX_MULTIPLIER) * skill;
  const progress = flying
    ? Math.expm1(bounded * 2.6) / Math.expm1(2.6)
    : Math.pow(bounded, 1.2);
  return 1 + progress * (maximum - 1);
}
