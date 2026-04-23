import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Artist, ArtistDocument } from '../artists/schemas/artist.schema';
import { Track, TrackDocument } from '../tracks/schemas/track.schema';
import {
  LibraryTrackAccess,
  LibraryTrackAccessDocument,
} from './schemas/library-track-access.schema';

function escapeRegexFragment(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Exclui documentos-filhos de variação da busca/descobre — uma entrada por música no catálogo. */
function canonicalTrackOnlyClause(): Record<string, unknown> {
  return {
    $or: [
      { variationOfTrackId: { $exists: false } },
      { variationOfTrackId: null },
    ],
  };
}

function buildCifraHref(artistSlug: string, songSlug: string): string {
  return `/cifras/${encodeURIComponent(artistSlug)}/${encodeURIComponent(songSlug)}`;
}

function buildCifraEditHref(artistSlug: string, songSlug: string): string {
  return `/cifras/${encodeURIComponent(artistSlug)}/${encodeURIComponent(songSlug)}/edit`;
}

export type LibrarySearchTrackRow = {
  id: string;
  trackKey: string | null;
  name: string;
  artistName: string;
  artistId: string;
  imageUrl: string | null;
};

export type LibrarySearchResponse = {
  items: LibrarySearchTrackRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type LibraryCatalogTab = 'musicas' | 'artistas' | 'albuns' | 'playlists';

export type LibraryCatalogTrackItem = {
  id: string;
  trackKey: string | null;
  name: string;
  artistName: string;
  artistId: string;
  imageUrl: string | null;
  isPrivate: boolean;
  isSaved: boolean;
  hasMyVersion: boolean;
  isOwnerVersion: boolean;
  accessHref: string | null;
  editHref: string | null;
  updatedAt: string | null;
};

export type LibraryCatalogArtistItem = {
  id: string;
  artistName: string;
  artistId: string;
  imageUrl: string | null;
  tracksCount: number;
  hasMyVersion: boolean;
};

export type LibraryCatalogResponse = {
  tab: LibraryCatalogTab;
  tracks: LibraryCatalogTrackItem[];
  artists: LibraryCatalogArtistItem[];
  total: number;
};

@Injectable()
export class LibraryHomeService {
  constructor(
    @InjectModel(LibraryTrackAccess.name)
    private readonly trackAccessModel: Model<LibraryTrackAccessDocument>,
    @InjectModel(Track.name)
    private readonly trackModel: Model<TrackDocument>,
    @InjectModel(Artist.name)
    private readonly artistModel: Model<ArtistDocument>,
  ) {}

  /** Resolve documentos de faixa a partir dos registos de acesso (ObjectId e/ou trackKey). */
  private async hydrateTracksFromAccesses(
    accesses: LibraryTrackAccessDocument[],
    limit: number,
  ): Promise<Array<{ track: TrackDocument; lastAccessAt: Date | null }>> {
    const resolved: Array<{ track: TrackDocument; lastAccessAt: Date | null }> =
      [];
    const seen = new Set<string>();

    for (const access of accesses) {
      let doc: TrackDocument | null = null;

      if (access.trackId) {
        doc = (await this.trackModel
          .findById(access.trackId)
          .populate('artistId', 'name')
          .exec()) as TrackDocument | null;
      }
      if (!doc && access.trackKey?.trim()) {
        doc = (await this.trackModel
          .findOne({ trackId: access.trackKey.trim() })
          .populate('artistId', 'name')
          .exec()) as TrackDocument | null;
      }

      if (doc && !seen.has(String(doc._id))) {
        seen.add(String(doc._id));
        resolved.push({
          track: doc,
          lastAccessAt: access.lastAccessAt ?? null,
        });
      }
      if (resolved.length >= limit) break;
    }

    return resolved;
  }

  /**
   * Lista para a secção «Descobre» até existir motor de recomendação dedicado
   * (serviço gerenciado, vector search ou modelo batch). Enquanto isso: catálogo recente.
   */
  private async getRecommendedTracks(
    _userId: string | undefined,
    limit: number,
  ): Promise<TrackDocument[]> {
    return this.trackModel
      .find(canonicalTrackOnlyClause())
      .populate('artistId', 'name')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .exec();
  }

  private async getRecentTracks(
    userId: string | undefined,
    limit: number,
  ): Promise<Array<TrackDocument & { lastAccessAt?: Date | null }>> {
    if (!userId) {
      return this.trackModel
        .find(canonicalTrackOnlyClause())
        .populate('artistId', 'name')
        .sort({ updatedAt: -1, _id: -1 })
        .limit(limit)
        .exec();
    }

    const normalizedUserId = userId.trim();
    const accesses = await this.trackAccessModel
      .find({ userId: normalizedUserId })
      .sort({ lastAccessAt: -1, _id: -1 })
      .limit(limit)
      .exec();
    const recentTracks = await this.hydrateTracksFromAccesses(accesses, limit);

    return recentTracks.map(({ track, lastAccessAt }) => {
      const row = track.toObject() as TrackDocument & {
        lastAccessAt?: Date | null;
      };
      row.lastAccessAt = lastAccessAt;
      return row;
    });
  }

  async getHomeFeed(params: {
    userId?: string;
    recommendedLimit?: number;
    recentLimit?: number;
  }): Promise<{ recommended: TrackDocument[]; recent: TrackDocument[] }> {
    const recommendedLimit = params.recommendedLimit ?? 12;
    const recentLimit = params.recentLimit ?? 8;
    const userId = params.userId?.trim() || undefined;

    const [recommended, recent] = await Promise.all([
      this.getRecommendedTracks(userId, recommendedLimit),
      this.getRecentTracks(userId, recentLimit),
    ]);

    return { recommended, recent };
  }

  async registerTrackAccess(params: {
    userId: string;
    trackId: string;
  }): Promise<void> {
    const userId = params.userId.trim();
    if (!userId) return;
    if (!Types.ObjectId.isValid(params.trackId)) return;

    const trackObjectId = new Types.ObjectId(params.trackId);
    const track = await this.trackModel
      .findOne({ _id: trackObjectId })
      .select('trackId')
      .exec();
    if (!track) return;

    const key = typeof track.trackId === 'string' ? track.trackId.trim() : '';
    if (key) {
      await this.registerTrackAccessByKey({ userId, trackKey: key });
      return;
    }

    const now = new Date();
    await this.trackAccessModel.updateOne(
      { userId, trackId: trackObjectId },
      {
        $set: { lastAccessAt: now },
        $setOnInsert: { firstAccessAt: now },
        $inc: { accessCount: 1 },
      },
      { upsert: true },
    );
  }

  async registerTrackAccessByKey(params: {
    userId: string;
    trackKey: string;
  }): Promise<void> {
    const userId = params.userId.trim();
    const key = params.trackKey.trim();
    if (!userId || !key) return;

    const track = await this.trackModel
      .findOne({ trackId: key })
      .select('_id')
      .exec();

    const now = new Date();
    const $set: Record<string, unknown> = {
      lastAccessAt: now,
      trackKey: key,
    };
    if (track) {
      $set.trackId = track._id;
    }

    await this.trackAccessModel.updateOne(
      { userId, trackKey: key },
      {
        $set: $set,
        $setOnInsert: { firstAccessAt: now },
        $inc: { accessCount: 1 },
      },
      { upsert: true },
    );
  }

  async saveTrackByKey(params: {
    userId: string;
    trackKey: string;
  }): Promise<void> {
    const userId = params.userId.trim();
    const key = params.trackKey.trim();
    if (!userId || !key) return;

    const track = await this.trackModel
      .findOne({ trackId: key })
      .select('_id')
      .exec();

    const now = new Date();
    const $set: Record<string, unknown> = {
      lastAccessAt: now,
      trackKey: key,
      isSaved: true,
      savedAt: now,
    };
    if (track) {
      $set.trackId = track._id;
    }

    await this.trackAccessModel.updateOne(
      { userId, trackKey: key },
      {
        $set,
        $setOnInsert: { firstAccessAt: now },
        $inc: { accessCount: 1 },
      },
      { upsert: true },
    );
  }

  async unregisterTrackAccessByKey(params: {
    userId: string;
    trackKey: string;
  }): Promise<void> {
    const userId = params.userId.trim();
    const key = params.trackKey.trim();
    if (!userId || !key) return;
    await this.trackAccessModel
      .updateOne(
        { userId, trackKey: key },
        {
          $set: {
            isSaved: false,
          },
          $unset: {
            savedAt: '',
          },
        },
      )
      .exec();
  }

  private serializeSearchTrack(track: TrackDocument): LibrarySearchTrackRow {
    const populated = track.artistId as unknown as
      | ArtistDocument
      | Types.ObjectId
      | string
      | null;
    let artistName = 'Artista desconhecido';
    let artistIdStr = '';
    if (populated && typeof populated === 'object' && 'name' in populated) {
      artistName =
        typeof populated.name === 'string' && populated.name.trim()
          ? populated.name.trim()
          : artistName;
      artistIdStr =
        '_id' in populated && populated._id ? String(populated._id) : '';
    }

    const trackKey =
      typeof track.trackId === 'string' && track.trackId.trim()
        ? track.trackId.trim()
        : null;

    return {
      id: String(track._id),
      trackKey,
      name:
        typeof track.name === 'string' && track.name.trim()
          ? track.name.trim()
          : 'Sem nome',
      artistName,
      artistId: artistIdStr,
      imageUrl: null,
    };
  }

  async searchTracks(params: {
    search: string;
    page: number;
    limit: number;
  }): Promise<LibrarySearchResponse> {
    const raw = params.search.trim();
    const page = params.page;
    const limit = params.limit;

    if (!raw) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }

    const escaped = escapeRegexFragment(raw);
    const matchingArtists = await this.artistModel
      .find({ name: { $regex: escaped, $options: 'i' } })
      .select('_id')
      .exec();
    const artistIds = matchingArtists.map((a) => a._id);

    const filter: Record<string, unknown> = {
      $and: [
        {
          $or: [
            { name: { $regex: escaped, $options: 'i' } },
            ...(artistIds.length ? [{ artistId: { $in: artistIds } }] : []),
          ],
        },
        canonicalTrackOnlyClause(),
      ],
    };

    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      this.trackModel
        .find(filter)
        .populate('artistId', 'name')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.trackModel.countDocuments(filter).exec(),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      items: documents.map((doc) => this.serializeSearchTrack(doc)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async listCatalog(params: {
    userId?: string;
    tab: LibraryCatalogTab;
    limit?: number;
  }): Promise<LibraryCatalogResponse> {
    const userId = params.userId?.trim() || '';
    const limit = Math.max(1, Math.min(params.limit ?? 200, 300));

    const accessFilter = userId ? { userId } : null;
    const accesses = accessFilter
      ? await this.trackAccessModel
          .find({ ...accessFilter, isSaved: true })
          .sort({ lastAccessAt: -1, _id: -1 })
          .limit(limit * 4)
          .select('trackId trackKey')
          .exec()
      : [];

    const savedTrackIdSet = new Set<string>();
    const savedTrackKeySet = new Set<string>();
    for (const access of accesses) {
      if (access.trackId) savedTrackIdSet.add(String(access.trackId));
      const k =
        typeof access.trackKey === 'string' && access.trackKey.trim()
          ? access.trackKey.trim()
          : '';
      if (k) savedTrackKeySet.add(k);
    }

    const myTracks = userId
      ? await this.trackModel
          .find({ userId })
          .select('_id trackId variationOfTrackId')
          .exec()
      : [];
    const myVariationBaseKeys = new Set<string>();
    for (const track of myTracks) {
      const baseKey =
        typeof track.variationOfTrackId === 'string' &&
        track.variationOfTrackId.trim()
          ? track.variationOfTrackId.trim()
          : '';
      if (baseKey) myVariationBaseKeys.add(baseKey);
    }

    const visibilityClause = userId
      ? {
          $or: [
            { _id: { $in: [...savedTrackIdSet] } },
            { trackId: { $in: [...savedTrackKeySet] } },
          ],
        }
      : { is_private: { $ne: true } };

    const documents = await this.trackModel
      .find(visibilityClause)
      .populate('artistId', 'name')
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit)
      .exec();

    const trackRows: LibraryCatalogTrackItem[] = documents.map((doc) => {
      const serialized = this.serializeSearchTrack(doc);
      const key =
        typeof doc.trackId === 'string' && doc.trackId.trim() ? doc.trackId.trim() : '';
      const ownerSub = typeof doc.userId === 'string' ? doc.userId.trim() : '';
      const isVariation =
        typeof doc.variationOfTrackId === 'string' &&
        doc.variationOfTrackId.trim().length > 0;
      const isOwnerVersion = Boolean(userId && isVariation && ownerSub === userId);
      const baseKey =
        typeof doc.variationOfTrackId === 'string' && doc.variationOfTrackId.trim()
          ? doc.variationOfTrackId.trim()
          : key;
      const isSaved = Boolean(
        savedTrackIdSet.has(String(doc._id)) || (key && savedTrackKeySet.has(key)),
      );
      const updatedAtRaw = (doc as unknown as { updatedAt?: Date | string })
        .updatedAt;
      const baseArtistSlug =
        typeof doc.baseArtistSlug === 'string' ? doc.baseArtistSlug.trim() : '';
      const baseSongSlug =
        typeof doc.baseSongSlug === 'string' ? doc.baseSongSlug.trim() : '';
      const hrefBase =
        baseArtistSlug && baseSongSlug
          ? buildCifraHref(baseArtistSlug, baseSongSlug)
          : baseKey
            ? `/cifras?trackId=${encodeURIComponent(baseKey)}`
            : null;
      const hrefEditBase =
        baseArtistSlug && baseSongSlug
          ? buildCifraEditHref(baseArtistSlug, baseSongSlug)
          : key
            ? `/cifras/edit?trackId=${encodeURIComponent(key)}`
            : null;
      const accessHref =
        isOwnerVersion && hrefBase && key
          ? `${hrefBase}?v=${encodeURIComponent(key)}`
          : hrefBase;
      const editHref =
        isOwnerVersion && hrefEditBase
          ? key
            ? `${hrefEditBase}?v=${encodeURIComponent(key)}`
            : hrefEditBase
          : null;
      return {
        ...serialized,
        imageUrl:
          typeof doc.coverImageUrl === 'string' && doc.coverImageUrl.trim()
            ? doc.coverImageUrl.trim()
            : null,
        isPrivate: doc.is_private === true,
        isSaved,
        hasMyVersion: Boolean(baseKey && myVariationBaseKeys.has(baseKey)),
        isOwnerVersion,
        accessHref,
        editHref,
        updatedAt: updatedAtRaw ? new Date(updatedAtRaw).toISOString() : null,
      };
    });

    if (params.tab === 'musicas') {
      return {
        tab: params.tab,
        tracks: trackRows,
        artists: [],
        total: trackRows.length,
      };
    }

    if (params.tab === 'artistas') {
      const grouped = new Map<string, LibraryCatalogArtistItem>();
      for (const row of trackRows) {
        const key = row.artistId || row.artistName;
        if (!key) continue;
        const current = grouped.get(key);
        if (!current) {
          grouped.set(key, {
            id: key,
            artistId: row.artistId,
            artistName: row.artistName,
            imageUrl: row.imageUrl,
            tracksCount: 1,
            hasMyVersion: row.hasMyVersion,
          });
          continue;
        }
        current.tracksCount += 1;
        current.hasMyVersion = current.hasMyVersion || row.hasMyVersion;
        if (!current.imageUrl && row.imageUrl) current.imageUrl = row.imageUrl;
      }
      const artists = [...grouped.values()].sort((a, b) =>
        a.artistName.localeCompare(b.artistName, 'pt-BR'),
      );
      return {
        tab: params.tab,
        tracks: [],
        artists,
        total: artists.length,
      };
    }

    return {
      tab: params.tab,
      tracks: [],
      artists: [],
      total: 0,
    };
  }
}
