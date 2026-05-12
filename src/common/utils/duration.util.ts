const DURATION_REGEX = /^(\d+)([smhd])$/;

const UNIT_TO_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function durationToMilliseconds(input: string): number {
  const match = DURATION_REGEX.exec(input.trim());
  if (!match) {
    throw new Error(`Unsupported duration format: ${input}`);
  }

  const value = Number(match[1]);
  const unit = match[2];
  return value * UNIT_TO_MS[unit];
}
