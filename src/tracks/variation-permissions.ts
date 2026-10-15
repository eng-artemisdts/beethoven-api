export type VariationPermissions = {
  /** O visitante pode gravar alterações nesta faixa como variação sua. */
  canEdit: boolean;
  /** O visitante pode excluir esta faixa (só variações que ele criou). */
  canDelete: boolean;
  /** API dona do documento: variações são sempre da Beethoven. */
  source: 'beethoven';
};

/**
 * Permissões do visitante sobre uma faixa. Só variações (`variationOfTrackId`) do próprio
 * utilizador podem ser editadas ou excluídas aqui; a cifra base pertence ao Schubert, mesmo
 * quando o visitante foi quem a importou.
 */
export function variationPermissions(
  track: { userId?: unknown; variationOfTrackId?: unknown },
  viewerSub?: string,
): VariationPermissions {
  const viewer = viewerSub?.trim() ?? '';
  const owner = typeof track.userId === 'string' ? track.userId.trim() : '';
  const isVariation =
    typeof track.variationOfTrackId === 'string' &&
    track.variationOfTrackId.trim().length > 0;
  const mine = Boolean(viewer && isVariation && owner === viewer);
  return { canEdit: mine, canDelete: mine, source: 'beethoven' };
}

/** Serializa o documento (igual à resposta padrão do Nest) e acrescenta as permissões do visitante. */
export function withVariationPermissions<
  T extends {
    toJSON(): object;
    userId?: unknown;
    variationOfTrackId?: unknown;
  },
>(track: T, viewerSub?: string): object {
  return { ...track.toJSON(), ...variationPermissions(track, viewerSub) };
}
