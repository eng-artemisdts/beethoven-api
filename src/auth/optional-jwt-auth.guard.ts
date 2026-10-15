import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * Leituras que servem visitante e utilizador autenticado: com Bearer válido preenche `req.user`;
 * sem Bearer, ou com token inválido/expirado, segue como visitante (`req.user` indefinido).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.headers.authorization) return true;
    try {
      await super.canActivate(context);
    } catch {
      /* visitante */
    }
    return true;
  }

  override handleRequest<TUser = unknown>(
    _err: unknown,
    user: TUser | false,
  ): TUser {
    return (user || undefined) as TUser;
  }
}
