function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildContainsRegex(input: string, flags = 'i'): RegExp {
  return new RegExp(escapeRegex(input.trim()), flags);
}

export function buildStartsWithRegex(input: string, flags = 'i'): RegExp {
  return new RegExp(`^${escapeRegex(input.trim())}`, flags);
}
