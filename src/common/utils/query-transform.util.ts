export function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  return undefined;
}

export function toStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return undefined;
}

export function toNumberArray(value: unknown): number[] | undefined {
  const parsed = toStringArray(value);
  if (!parsed) {
    return undefined;
  }

  const numbers = parsed
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item));

  return numbers.length > 0 ? numbers : undefined;
}
