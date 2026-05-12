const DEFAULT_EXTERNAL_AVATAR_URLS = new Set(['https://placehold.co/100x100/png']);

export function sanitizeAvatarUrl(avatarUrl?: string | null): string {
  const normalized = avatarUrl?.trim() ?? '';
  if (!normalized) {
    return '';
  }

  return DEFAULT_EXTERNAL_AVATAR_URLS.has(normalized) ? '' : normalized;
}
