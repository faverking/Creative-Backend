import { Types } from 'mongoose';

export type MediaReferenceInput = string | Types.ObjectId | null | undefined;

const MEDIA_ID_IN_PATH_PATTERN = /\/media\/([0-9a-fA-F]{24})(?:\/|$)/;

export function extractMediaReferenceId(mediaRef: MediaReferenceInput): string | undefined {
  if (!mediaRef) {
    return undefined;
  }

  const rawValue = typeof mediaRef === 'string' ? mediaRef.trim() : mediaRef.toString();
  if (Types.ObjectId.isValid(rawValue)) {
    return rawValue;
  }

  const matched = rawValue.match(MEDIA_ID_IN_PATH_PATTERN);
  return matched && Types.ObjectId.isValid(matched[1]) ? matched[1] : undefined;
}

export function normalizeMediaReferenceIds(mediaRefs: MediaReferenceInput[]): string[] {
  return Array.from(
    new Set(
      mediaRefs
        .map((mediaRef) => extractMediaReferenceId(mediaRef))
        .filter((mediaId): mediaId is string => Boolean(mediaId)),
    ),
  );
}

export function pickFirstMediaReferenceId(mediaRefs: MediaReferenceInput[]): string | undefined {
  return normalizeMediaReferenceIds(mediaRefs)[0];
}

export function collectMediaReferenceIds(...groups: MediaReferenceInput[][]): string[] {
  return Array.from(new Set(groups.flatMap((group) => normalizeMediaReferenceIds(group))));
}
