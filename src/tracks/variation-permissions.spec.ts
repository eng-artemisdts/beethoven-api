import {
  variationPermissions,
  withVariationPermissions,
} from './variation-permissions';

const OWNER = 'auth0|dono';

describe('variationPermissions', () => {
  it('dono da variação pode editar e excluir', () => {
    expect(
      variationPermissions(
        { userId: OWNER, variationOfTrackId: 'url_base' },
        OWNER,
      ),
    ).toEqual({ canEdit: true, canDelete: true, source: 'beethoven' });
  });

  it('quem importou a cifra base pode editá-la e excluí-la', () => {
    expect(variationPermissions({ userId: OWNER }, OWNER)).toEqual({
      canEdit: true,
      canDelete: true,
      source: 'schubert',
    });
    expect(
      variationPermissions({ userId: OWNER, variationOfTrackId: '' }, OWNER),
    ).toMatchObject({ canDelete: true, source: 'schubert' });
  });

  it('outro utilizador e visitante não editam nem excluem', () => {
    const variation = { userId: OWNER, variationOfTrackId: 'url_base' };
    expect(variationPermissions(variation, 'auth0|outro')).toMatchObject({
      canEdit: false,
      canDelete: false,
    });
    expect(variationPermissions(variation, undefined)).toMatchObject({
      canEdit: false,
      canDelete: false,
    });
  });

  it('acrescenta as permissões ao documento serializado', () => {
    const doc = {
      userId: OWNER,
      variationOfTrackId: 'url_base',
      toJSON: () => ({ trackId: 'v_url_base_1', userId: OWNER }),
    };
    expect(withVariationPermissions(doc, OWNER)).toEqual({
      trackId: 'v_url_base_1',
      userId: OWNER,
      canEdit: true,
      canDelete: true,
      source: 'beethoven',
    });
  });
});
