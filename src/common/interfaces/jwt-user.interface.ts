export interface JwtUser {
  userId: string;
  roles: string[];
  passwordVersion: number;
  status: string;
  name: string;
}
