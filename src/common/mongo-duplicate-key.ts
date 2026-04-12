import { ConflictException } from '@nestjs/common';

function isMongoDuplicateKey(
  error: unknown,
): error is { code: number; keyValue?: Record<string, unknown> } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: number }).code === 11000
  );
}

/**
 * Converte E11000 do MongoDB em {@link ConflictException} (HTTP 409) com mensagem legível.
 */
export function rethrowAsConflictIfDuplicateKey(
  error: unknown,
  entity: 'track' | 'artist',
): never {
  if (!isMongoDuplicateKey(error)) {
    throw error;
  }
  const kv = error.keyValue ?? {};
  if (entity === 'track') {
    if (kv.trackId != null) {
      const id =
        typeof kv.trackId === 'string' || typeof kv.trackId === 'number'
          ? String(kv.trackId)
          : JSON.stringify(kv.trackId);
      throw new ConflictException(
        `Já existe uma faixa com trackId "${id}". Use outro trackId ou atualize o registo existente.`,
      );
    }
    if (kv.spotifyId != null) {
      throw new ConflictException(
        'Já existe uma faixa registada com este spotifyId.',
      );
    }
    throw new ConflictException(
      'Não foi possível criar a faixa: conflito com um índice único na base de dados.',
    );
  }
  if (kv.spotifyId != null) {
    throw new ConflictException(
      'Já existe um artista registado com este spotifyId.',
    );
  }
  throw new ConflictException(
    'Não foi possível criar o artista: conflito com um índice único na base de dados.',
  );
}
