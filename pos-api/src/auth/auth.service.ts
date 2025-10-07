import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async validate(username: string, password: string) {
    const user = await this.users.findByUsername(username);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    const roles = user.roles.map((r) => r.role.code);
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      roles,
    };
  }

  async login(username: string, password: string) {
    const u = await this.validate(username, password);

    const access = this.jwt.sign(
      { sub: u.id, username: u.username, roles: u.roles },
      {
        secret:
          this.config.get<string>('JWT_SECRET') ||
          'default-secret-key-change-in-production',
        expiresIn: '30m',
      },
    );
    const refresh = this.jwt.sign(
      { sub: u.id },
      {
        secret:
          this.config.get<string>('JWT_REFRESH_SECRET') ||
          'default-refresh-secret-key-change-in-production',
        expiresIn: '7d',
      },
    );

    return { access_token: access, refresh_token: refresh, user: u };
  }
}
