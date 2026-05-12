import { ROLE_SUPER_ADMIN } from '../../common/constants/roles';

export const SYSTEM_SUPER_ADMIN = {
  email: 'superad@email.com',
  name: 'SuperAd',
  password: '123456@pww',
  roles: [ROLE_SUPER_ADMIN],
} as const;
