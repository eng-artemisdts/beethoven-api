import type { ExecutionContext } from '@nestjs/common';

import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

function contextWith(headers: Record<string, string>) {
  const req: { headers: Record<string, string>; user?: unknown } = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return { context, req };
}

describe('OptionalJwtAuthGuard', () => {
  it('deixa passar visitante sem Authorization', async () => {
    const { context, req } = contextWith({});
    await expect(new OptionalJwtAuthGuard().canActivate(context)).resolves.toBe(
      true,
    );
    expect(req.user).toBeUndefined();
  });

  it('com token inválido segue como visitante em vez de responder 401', async () => {
    const { context, req } = contextWith({ authorization: 'Bearer invalido' });
    await expect(new OptionalJwtAuthGuard().canActivate(context)).resolves.toBe(
      true,
    );
    expect(req.user).toBeUndefined();
  });

  it('handleRequest devolve o utilizador quando existe e nunca lança', () => {
    const guard = new OptionalJwtAuthGuard();
    expect(guard.handleRequest(null, { sub: 'auth0|x' })).toEqual({
      sub: 'auth0|x',
    });
    expect(guard.handleRequest(new Error('expirado'), false)).toBeUndefined();
  });
});
