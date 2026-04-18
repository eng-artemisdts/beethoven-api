import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Track, TrackDocument } from '../tracks/schemas/track.schema';
import {
  LibraryRecommendation,
  LibraryRecommendationDocument,
} from './schemas/library-recommendation.schema';
import {
  LibraryTrackAccess,
  LibraryTrackAccessDocument,
} from './schemas/library-track-access.schema';

@Injectable()
export class LibraryHomeService {
  constructor(
    @InjectModel(LibraryRecommendation.name)
    private readonly recommendationModel: Model<LibraryRecommendationDocument>,
    @InjectModel(LibraryTrackAccess.name)
    private readonly trackAccessModel: Model<LibraryTrackAccessDocument>,
    @InjectModel(Track.name)
    private readonly trackModel: Model<TrackDocument>,
  ) { }

  private async hydrateTracksByIds(
    trackIds: Types.ObjectId[],
    limit: number,
  ): Promise<TrackDocument[]> {
    if (!trackIds.length) return [];
    const tracks = (await this.trackModel
      .find({ _id: { $in: trackIds } })
      .populate('artistId', 'name')
      .exec()) as TrackDocument[];
    const byId = new Map(tracks.map((track) => [String(track._id), track]));
    const ordered: TrackDocument[] = [];
    for (const id of trackIds) {
      const track = byId.get(String(id));
      if (track) ordered.push(track);
      if (ordered.length >= limit) break;
    }
    return ordered;
  }

  private async getRecommendedTracks(
    userId: string | undefined,
    limit: number,
  ): Promise<TrackDocument[]> {
    const now = new Date();
    const baseFilter = {
      isActive: true,
      $and: [
        { $or: [{ startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
      ],
    };

    const globalRecommendations = await this.recommendationModel
      .find({
        ...baseFilter,
        $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }],
      })
      .sort({ score: -1, createdAt: -1, _id: -1 })
      .limit(limit)
      .exec();

    const userRecommendations = userId
      ? await this.recommendationModel
        .find({ ...baseFilter, userId })
        .sort({ score: -1, createdAt: -1, _id: -1 })
        .limit(limit)
        .exec()
      : [];

    const combinedTrackIds = [...userRecommendations, ...globalRecommendations]
      .map((row) => row.trackId)
      .filter((value, index, arr) => index === arr.findIndex((x) => String(x) === String(value)))
      .slice(0, limit);

    const curatedTracks = await this.hydrateTracksByIds(combinedTrackIds, limit);
    if (curatedTracks.length >= limit) return curatedTracks;

    const excludeIds = curatedTracks.map((track) => track._id);
    const fillTracks = await this.trackModel
      .find({ _id: { $nin: excludeIds } })
      .populate('artistId', 'name')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit - curatedTracks.length)
      .exec();

    return [...curatedTracks, ...fillTracks];
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
    const recentTrackIds = accesses.map((item) => item.trackId);
    const recentTracks = await this.hydrateTracksByIds(recentTrackIds, limit);
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
    const exists = await this.trackModel.exists({ _id: trackObjectId });
    if (!exists) return;

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

    await this.recommendationModel.updateOne(
      { userId, trackId: trackObjectId },
      {
        $set: { isActive: true, source: 'history' },
        $inc: { score: 1 },
      },
      { upsert: true },
    );
  }

  async registerTrackAccessByKey(params: {
    userId: string;
    trackKey: string;
  }): Promise<void> {
    const key = params.trackKey.trim();
    if (!key) return;
    const track = await this.trackModel.findOne({ trackId: key }).select('_id').exec();
    if (!track) return;
    await this.registerTrackAccess({
      userId: params.userId,
      trackId: String(track._id),
    });
  }
}
