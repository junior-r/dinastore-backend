import { Role } from '../entities/user.entity';

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface TokenService {
  sign(payload: TokenPayload): string;
}
