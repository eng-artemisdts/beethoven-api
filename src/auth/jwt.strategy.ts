import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type Auth0JwtPayload = {
  sub: string;
  scope?: string;
  permissions?: string[];
  [key: string]: unknown;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {

    const domain = config.get<string>('AUTH0_DOMAIN')?.trim();
    const audience = config.get<string>('AUTH0_AUDIENCE')?.trim();

    if (!domain || !audience) {
      throw new Error(
        'Defina AUTH0_DOMAIN e AUTH0_AUDIENCE no ambiente (identificador da API no Auth0).',
      );
    }
    const issuer = `https://${domain}/`;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience,
      issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `https://${domain}/.well-known/jwks.json`,
      }),
    });
  }

  validate(payload: Auth0JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }
    return { sub: payload.sub, scope: payload.scope, permissions: payload.permissions };
  }
}
