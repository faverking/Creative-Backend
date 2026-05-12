export const CONTENT_LIST_SORTS = ['latest', 'hot', 'recommend'] as const;
export type ContentListSort = (typeof CONTENT_LIST_SORTS)[number];

export const MEDIA_VARIANTS = ['preview', 'download'] as const;
export type MediaVariant = (typeof MEDIA_VARIANTS)[number];
