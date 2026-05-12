import { buildImageBusinessTags } from './content-tag.util';

export function buildImagePackageMeta(total: number, themeId?: number, source?: string): string {
  const themeLabel = buildImageBusinessTags(themeId)[0] ?? '图包';
  const parts = [`${total}P`, themeLabel];
  const normalizedSource = source?.trim();

  if (normalizedSource) {
    parts.push(normalizedSource);
  }

  return parts.join(' / ');
}
