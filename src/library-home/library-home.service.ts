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
  ): Promise<TrackDocument[]> {
    const resolved: TrackDocument[] = [];
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
        resolved.push(doc);
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
      .find({})
      .populate('artistId', 'name')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .exec();
  }

  private async getRecentTracks(
    userId: string | undefined,
    limit: number,
  ): Promise<TrackDocument[]> {
    if (!userId) {
      return this.trackModel
        .find({})
        .populate('artistId', 'name')
        .sort({ updatedAt: -1, _id: -1 })
        .limit(limit)
        .exec();
    }

    const accesses = await this.trackAccessModel
      .find({ userId })
      .sort({ lastAccessAt: -1, _id: -1 })
      .limit(limit)
      .exec();
    const recentTracks = await this.hydrateTracksFromAccesses(accesses, limit);
    if (recentTracks.length >= limit) return recentTracks;

    const filledTracks = await this.trackModel
      .find({ _id: { $nin: recentTracks.map((track) => track._id) } })
      .populate('artistId', 'name')
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit - recentTracks.length)
      .exec();
    return [...recentTracks, ...filledTracks];
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

  async registerTrackAccess(params: { userId: string; trackId: string }): Promise<void> {
    const userId = params.userId.trim();
    if (!userId) return;
    if (!Types.ObjectId.isValid(params.trackId)) return;

    const trackObjectId = new Types.ObjectId(params.trackId);
    const track = await this.trackModel.findOne({ _id: trackObjectId }).select('trackId').exec();
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

    const track = await this.trackModel.findOne({ trackId: key }).select('_id').exec();

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
        '_id' in populated && populated._id
          ? String(populated._id)
          : '';
    }

    const trackKey =
      typeof track.trackId === 'string' && track.trackId.trim()
        ? track.trackId.trim()
        : null;

    return {
      id: String(track._id),
      trackKey,
      name: typeof track.name === 'string' && track.name.trim() ? track.name.trim() : 'Sem nome',
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
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        ...(artistIds.length ? [{ artistId: { $in: artistIds } }] : []),
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
}
