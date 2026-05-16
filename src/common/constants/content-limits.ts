export const CONTENT_BYTE_LIMITS = {
  article: {
    min: 10,
    max: 3 * 1024 * 1024,
  },
  draft: {
    min: 1,
    max: 3 * 1024 * 1024,
  },
  topic: {
    min: 2,
    max: 2 * 1024 * 1024,
  },
  comment: {
    min: 1,
    max: 16 * 1024,
  },
} as const;
