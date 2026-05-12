export const ROLE_USER = 'user';
export const ROLE_EDITOR = 'editor';
export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';

export const ALL_ROLES = [ROLE_USER, ROLE_EDITOR, ROLE_ADMIN, ROLE_SUPER_ADMIN] as const;
export type UserRole = (typeof ALL_ROLES)[number];
