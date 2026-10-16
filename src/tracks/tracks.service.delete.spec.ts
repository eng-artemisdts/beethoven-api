import { ConflictException, ForbiddenException } from '@nestjs/common';

import { TracksService } from './tracks.service';

const OWNER = 'auth0|dono';

type Doc = {
  _id: string;
  trackId: string;
  userId?: string;
  variationOfTrackId?: string;
};

function exec<T>(value: T) {
  return { exec: () => Promise.resolve(value) };
}

/** Modelos falsos com o mínimo que `deleteVariationByTrackId` usa. */
function setup(docs: Doc[]) {
  const store = [...docs];
  const matches = (doc: Doc, q: Record<string, unknown>) =>
    Object.entries(q).every(([k, v]) => {
      const value = doc[k as keyof Doc];
      if (v && typeof v === 'object' && '$ne' in v)
        return value !== (v as { $ne: unknown }).$ne;
      return value === v;
    });
  const trackModel = {
    findOne: (q: Record<string, unknown>) => ({
      populate: () => exec(store.find((d) => matches(d, q)) ?? null),
    }),
    countDocuments: (q: Record<string, unknown>) =>
      exec(store.filter((d) => matches(d, q)).length),
    find: (q: Record<string, unknown>) => ({
      select: () => exec(store.filter((d) => matches(d, q))),
    }),
    deleteOne: ({ _id }: { _id: string }) => {
      const i = store.findIndex((d) => d._id === _id);
      if (i >= 0) store.splice(i, 1);
      return exec({});
    },
    deleteMany: ({ _id }: { _id: { $in: string[] } }) => {
      for (const id of _id.$in) {
        const i = store.findIndex((d) => d._id === id);
        if (i >= 0) store.splice(i, 1);
      }
      return exec({});
    },
  };
  const trackAccessModel = { deleteMany: jest.fn(() => exec({})) };
  const service = new TracksService(
    trackModel as never,
    {} as never,
    trackAccessModel as never,
  );
  return { service, store, trackAccessModel };
}

describe('TracksService.deleteVariationByTrackId', () => {
  it('quem importou exclui a cifra base, as próprias versões e os acessos', async () => {
    const { service, store, trackAccessModel } = setup([
      { _id: 'b', trackId: 'url_base', userId: OWNER },
      {
        _id: 'v',
        trackId: 'v_url_base_1',
        userId: OWNER,
        variationOfTrackId: 'url_base',
      },
      { _id: 'x', trackId: 'url_outra', userId: OWNER },
    ]);
    await expect(
      service.deleteVariationByTrackId(OWNER, 'url_base'),
    ).resolves.toEqual({ ok: true });
    expect(store.map((d) => d._id)).toEqual(['x']);
    expect(trackAccessModel.deleteMany).toHaveBeenCalledWith({
      $or: [
        { trackKey: { $in: ['url_base', 'v_url_base_1'] } },
        { trackId: { $in: ['b', 'v'] } },
      ],
    });
  });

  it('recusa excluir a base quando outra pessoa criou uma versão dela', async () => {
    const { service, store } = setup([
      { _id: 'b', trackId: 'url_base', userId: OWNER },
      {
        _id: 'v',
        trackId: 'v_url_base_1',
        userId: 'auth0|outro',
        variationOfTrackId: 'url_base',
      },
    ]);
    await expect(
      service.deleteVariationByTrackId(OWNER, 'url_base'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(store).toHaveLength(2);
  });

  it('só quem criou pode excluir', async () => {
    const { service } = setup([
      { _id: 'b', trackId: 'url_base', userId: OWNER },
    ]);
    await expect(
      service.deleteVariationByTrackId('auth0|outro', 'url_base'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('variação do próprio usuário continua sendo excluída sozinha', async () => {
    const { service, store } = setup([
      { _id: 'b', trackId: 'url_base', userId: 'auth0|outro' },
      {
        _id: 'v',
        trackId: 'v_url_base_1',
        userId: OWNER,
        variationOfTrackId: 'url_base',
      },
    ]);
    await service.deleteVariationByTrackId(OWNER, 'v_url_base_1');
    expect(store.map((d) => d._id)).toEqual(['b']);
  });
});
