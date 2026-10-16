export type VariationPermissions = {
  /** O visitante pode gravar alterações nesta faixa (é ele quem a criou). */
  canEdit: boolean;
  /** O visitante pode excluir esta faixa (é ele quem a criou). */
  canDelete: boolean;
  /** API dona do documento: variações são da Beethoven; a cifra base é do Schubert. */
  source: 'beethoven' | 'schubert';
};

/**
 * Permissões do visitante sobre uma faixa: quem a criou edita e exclui — a sua variação ou a
 * cifra base que importou. A exclusão de uma base ainda é recusada no servidor quando outras
 * pessoas criaram versões a partir dela.
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
  const mine = Boolean(viewer && owner === viewer);
  return {
    canEdit: mine,
    canDelete: mine,
    source: isVariation ? 'beethoven' : 'schubert',
  };
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
