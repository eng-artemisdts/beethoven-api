import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { rethrowAsConflictIfDuplicateKey } from '../common/mongo-duplicate-key';
import type { LyricsSource } from '../domain/music-transcription.types';
import { ArtistsService } from '../artists/artists.service';
import { CreateTrackDto } from './dto/create-track.dto';
import type { TranscriptionLyricSegmentSubdoc } from './schemas/track.schema';
import { Track, TrackDocument } from './schemas/track.schema';
import { normalizeChordListFromClient } from './transcription-chord-normalize.util';

@Injectable()
export class TracksService {
  constructor(
    @InjectModel(Track.name) private readonly trackModel: Model<TrackDocument>,
    private readonly artistsService: ArtistsService,
  ) {}

  /** Deriva `lyrics` + `lyricsSource` a partir do DTO (`lyricsSource` omisso ⇒ `MATCH`). */
  private resolveLyricsPayload(dto: CreateTrackDto):
    | {
        lyrics: TranscriptionLyricSegmentSubdoc[];
        lyricsSource: LyricsSource;
      }
    | undefined {
    const newLyrics = dto.lyrics;
    const newSource = dto.lyricsSource;
    if (newLyrics !== undefined && newLyrics.length > 0) {
      const source: LyricsSource = newSource ?? 'MATCH';
      return {
        lyrics: newLyrics as TranscriptionLyricSegmentSubdoc[],
        lyricsSource: source,
      };
    }

    return undefined;
  }

  private sanitizeVariationLabel(value: unknown): string {
    return typeof value === 'string' ? value.trim().slice(0, 120) : '';
  }

  private sanitizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized.length ? normalized : undefined;
  }

  private resolveSourceTrack(sourceTrack: unknown): {
    trackId?: string;
    spotifyId?: string;
    name?: string;
    artistId?: string;
    chords?: unknown;
    lyrics?: unknown;
    lyricsSource?: LyricsSource;
    sections?: unknown;
    meta?: unknown;
    chordTimeOffsetSec?: unknown;
    original_tune?: unknown;
    capo_at?: unknown;
    coverImageUrl?: unknown;
  } {
    if (!sourceTrack || typeof sourceTrack !== 'object') {
      throw new BadRequestException('sourceTrack inválido.');
    }
    return sourceTrack as {
      trackId?: string;
      spotifyId?: string;
      name?: string;
      artistId?: string;
      chords?: unknown;
      lyrics?: unknown;
      lyricsSource?: LyricsSource;
      sections?: unknown;
      meta?: unknown;
      chordTimeOffsetSec?: unknown;
      original_tune?: unknown;
      capo_at?: unknown;
      coverImageUrl?: unknown;
    };
  }

  async create(dto: CreateTrackDto): Promise<TrackDocument> {
    await this.artistsService.findOne(dto.artistId);
    const resolvedLyrics = this.resolveLyricsPayload(dto);
    const { artistId, lyrics: _lyrics, lyricsSource: _ls, ...rest } = dto;
    void _lyrics;
    void _ls;
    const doc = new this.trackModel({
      ...rest,
      ...(resolvedLyrics
        ? {
            lyrics: resolvedLyrics.lyrics,
            lyricsSource: resolvedLyrics.lyricsSource,
          }
        : {}),
      artistId: new Types.ObjectId(artistId),
    });
    try {
      return await doc.save();
    } catch (e) {
      rethrowAsConflictIfDuplicateKey(e, 'track');
    }
  }

  async findAll(artistId?: string): Promise<TrackDocument[]> {
    const hasArtistFilter =
      artistId !== undefined && artistId !== null && artistId !== '';
    if (hasArtistFilter && !Types.ObjectId.isValid(artistId)) {
      throw new BadRequestException('artistId inválido');
    }
    const filter = hasArtistFilter
      ? { artistId: new Types.ObjectId(artistId) }
      : {};
    return this.trackModel
      .find(filter)
      .populate('artistId', 'name')
      .sort({ trackId: 1, createdAt: 1 })
      .exec();
  }

  async findOne(id: string): Promise<TrackDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Música ${id} não encontrada`);
    }
    const track = await this.trackModel
      .findById(id)
      .populate('artistId', 'name')
      .exec();
    if (!track) {
      throw new NotFoundException(`Música ${id} não encontrada`);
    }
    return track;
  }

  async findByTrackId(trackId: string): Promise<TrackDocument> {
    const track = await this.trackModel
      .findOne({ trackId })
      .populate('artistId', 'name')
      .exec();
    if (!track) {
      throw new NotFoundException(
        `Música com trackId "${trackId}" não encontrada`,
      );
    }
    return track;
  }

  async findVariationsByBaseTrackId(
    baseTrackId: string,
    viewerSub?: string,
  ): Promise<TrackDocument[]> {
    const normalizedBase = baseTrackId.trim();
    if (!normalizedBase) return [];
    const normalizedViewer = viewerSub?.trim() || '';
    const privateFilter = normalizedViewer
      ? { $or: [{ is_private: { $ne: true } }, { userId: normalizedViewer }] }
      : { is_private: { $ne: true } };

    return this.trackModel
      .find({
        variationOfTrackId: normalizedBase,
        ...privateFilter,
      })
      .populate('artistId', 'name')
      .sort({ updatedAt: -1, _id: -1 })
      .exec();
  }

  async findMyVariationByBaseTrackId(
    baseTrackId: string,
    ownerSub: string,
  ): Promise<TrackDocument | null> {
    const normalizedBase = baseTrackId.trim();
    const normalizedOwner = ownerSub.trim();
    if (!normalizedBase || !normalizedOwner) return null;
    return this.trackModel
      .findOne({ variationOfTrackId: normalizedBase, userId: normalizedOwner })
      .populate('artistId', 'name')
      .exec();
  }

  async findVariationByTrackId(
    trackId: string,
    viewerSub?: string,
  ): Promise<TrackDocument> {
    const normalized = trackId.trim();
    if (!normalized) {
      throw new NotFoundException('Variação não encontrada');
    }
    const track = await this.trackModel
      .findOne({ trackId: normalized, variationOfTrackId: { $exists: true } })
      .populate('artistId', 'name')
      .exec();
    if (!track) {
      throw new NotFoundException(`Variação "${trackId}" não encontrada`);
    }
    const owner = typeof track.userId === 'string' ? track.userId.trim() : '';
    const isOwner = Boolean(owner && viewerSub?.trim() === owner);
    if (track.is_private === true && !isOwner) {
      throw new NotFoundException(`Variação "${trackId}" não encontrada`);
    }
    return track;
  }

  async createVariationFromSchubertTrack(
    ownerSub: string,
    body: {
      baseTrackId?: unknown;
      baseArtistSlug?: unknown;
      baseSongSlug?: unknown;
      sourceTrack?: unknown;
      variationLabel?: unknown;
      is_private?: unknown;
    },
  ): Promise<TrackDocument> {
    const normalizedSub = ownerSub.trim();
    const baseTrackId = this.sanitizeOptionalString(body.baseTrackId);
    const baseArtistSlug = this.sanitizeOptionalString(body.baseArtistSlug);
    const baseSongSlug = this.sanitizeOptionalString(body.baseSongSlug);
    if (!normalizedSub || !baseTrackId || !baseArtistSlug || !baseSongSlug) {
      throw new BadRequestException('Parâmetros da variação inválidos.');
    }
    const source = this.resolveSourceTrack(body.sourceTrack);
    const artistRaw = source.artistId;
    const artistObjId =
      typeof artistRaw === 'object' && artistRaw && '_id' in artistRaw
        ? (artistRaw as { _id?: unknown })._id
        : undefined;
    const artistId =
      typeof artistObjId === 'string'
        ? artistObjId
        : typeof artistRaw === 'string'
          ? artistRaw
          : '';
    if (!Types.ObjectId.isValid(artistId)) {
      throw new BadRequestException('artistId inválido na faixa base.');
    }
    const variationTrackId = `v_${baseTrackId}_${randomUUID().replace(/-/g, '').slice(0, 18)}`;
    const payload: CreateTrackDto = {
      artistId,
      trackId: variationTrackId,
      name: typeof source.name === 'string' ? source.name : undefined,
      spotifyId: undefined,
      userId: normalizedSub,
      variationOfTrackId: baseTrackId,
      variationLabel: this.sanitizeVariationLabel(body.variationLabel),
      baseArtistSlug,
      baseSongSlug,
      original_tune: this.sanitizeOptionalString(source.original_tune) ?? '',
      capo_at:
        Number.isFinite(source.capo_at as number) && Number(source.capo_at) >= 0
          ? Math.min(24, Math.round(Number(source.capo_at)))
          : 0,
      is_private: body.is_private === false ? false : true,
      chords: source.chords as CreateTrackDto['chords'],
      lyrics: source.lyrics as CreateTrackDto['lyrics'],
      lyricsSource: source.lyricsSource === 'MATCH' ? 'MATCH' : 'AI',
      sections: source.sections as CreateTrackDto['sections'],
      meta:
        source.meta && typeof source.meta === 'object'
          ? (source.meta as CreateTrackDto['meta'])
          : undefined,
      chordTimeOffsetSec:
        Number.isFinite(source.chordTimeOffsetSec as number) &&
        Number(source.chordTimeOffsetSec) >= 0
          ? Number(source.chordTimeOffsetSec)
          : undefined,
      coverImageUrl: this.sanitizeOptionalString(source.coverImageUrl),
    };
    return this.create(payload);
  }

  /** Atualização parcial de acordes / letras (sem verificação de dono — ativar JWT em produção). */
  async updateTranscriptionByTrackId(
    trackId: string,
    body: {
      chords?: unknown;
      lyrics?: unknown;
      lyricsSource?: LyricsSource;
    },
  ): Promise<TrackDocument> {
    const track = await this.findByTrackId(trackId);
    if (body.chords !== undefined) {
      const durationSec = track.meta?.duration_seconds;
      track.chords = normalizeChordListFromClient(body.chords, durationSec);
      track.markModified('chords');
    }
    if (body.lyrics !== undefined) {
      track.lyrics = body.lyrics as TranscriptionLyricSegmentSubdoc[];
      track.markModified('lyrics');
    }
    if (body.lyricsSource !== undefined) {
      track.lyricsSource = body.lyricsSource;
      track.markModified('lyricsSource');
    }
    await track.save();
    return this.findByTrackId(trackId);
  }

  async updateVariationByTrackId(
    ownerSub: string,
    trackId: string,
    body: {
      chords?: unknown;
      lyrics?: unknown;
      lyricsSource?: LyricsSource;
      sections?: unknown;
      variationLabel?: unknown;
      is_private?: unknown;
      original_tune?: unknown;
      capo_at?: unknown;
    },
  ): Promise<TrackDocument> {
    const track = await this.findByTrackId(trackId);
    const owner = typeof track.userId === 'string' ? track.userId.trim() : '';
    if (!owner || owner !== ownerSub.trim()) {
      throw new ForbiddenException(
        'Apenas o criador pode editar esta variação.',
      );
    }
    if (!track.variationOfTrackId?.trim()) {
      throw new BadRequestException('A faixa indicada não é uma variação.');
    }
    if (body.chords !== undefined) {
      const durationSec = track.meta?.duration_seconds;
      track.chords = normalizeChordListFromClient(body.chords, durationSec);
      track.markModified('chords');
    }
    if (body.lyrics !== undefined) {
      track.lyrics = body.lyrics as TranscriptionLyricSegmentSubdoc[];
      track.markModified('lyrics');
    }
    if (body.lyricsSource !== undefined) {
      track.lyricsSource = body.lyricsSource;
      track.markModified('lyricsSource');
    }
    if (body.sections !== undefined) {
      track.sections = Array.isArray(body.sections)
        ? (body.sections as Track['sections'])
        : [];
      track.markModified('sections');
    }
    if (body.variationLabel !== undefined) {
      track.variationLabel = this.sanitizeVariationLabel(body.variationLabel);
      track.markModified('variationLabel');
    }
    if (body.is_private !== undefined) {
      track.is_private = body.is_private === true;
      track.markModified('is_private');
    }
    if (body.original_tune !== undefined) {
      track.original_tune =
        this.sanitizeOptionalString(body.original_tune) ?? '';
      track.markModified('original_tune');
    }
    if (body.capo_at !== undefined) {
      const capo = Number(body.capo_at);
      track.capo_at = Number.isFinite(capo)
        ? Math.max(0, Math.min(24, Math.round(capo)))
        : 0;
      track.markModified('capo_at');
    }
    await track.save();
    return this.findByTrackId(trackId);
  }
}
