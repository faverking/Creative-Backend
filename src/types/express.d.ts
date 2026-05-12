import type { JwtUser } from '../common/interfaces/jwt-user.interface';

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
    }

    interface User extends JwtUser {}
  }
}

export {};
