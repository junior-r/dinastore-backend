import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { PasswordHasher } from '@/modules/users/domain/services/password-hasher';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(
      plainPassword,
      salt,
      KEY_LENGTH,
    )) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  async compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    const [salt, storedHash] = passwordHash.split(':');
    if (!salt || !storedHash) {
      return false;
    }
    const derivedKey = (await scryptAsync(
      plainPassword,
      salt,
      KEY_LENGTH,
    )) as Buffer;
    const storedHashBuffer = Buffer.from(storedHash, 'hex');
    if (storedHashBuffer.length !== derivedKey.length) {
      return false;
    }
    return timingSafeEqual(storedHashBuffer, derivedKey);
  }
}
