import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { rethrowAsConflictIfDuplicateKey } from '../common/mongo-duplicate-key';
import type { TranscriptionLyricsVariants } from '../domain/music-transcription.types';
import { ArtistsService } from '../artists/artists.service';
import { CreateTrackDto } from './dto/create-track.dto';
import type { TranscriptionLyricsVariantsSubdoc } from './schemas/track.schema';
import { Track, TrackDocument } from './schemas/track.schema';
import { normalizeChordListFromClient } from './transcription-chord-normalize.util';

@Injectable()
export class TracksService {
  constructor(
    @InjectModel(Track.name) private readonly trackModel: Model<TrackDocument>,
    private readonly artistsService: ArtistsService,
  ) {}

  private resolveLyricsVariants(
    dto: CreateTrackDto,
  ): TranscriptionLyricsVariants | undefined {
    const v = dto.lyricsVariants;
    const legacy = dto.lyrics;
    if (!v && !legacy?.length) {
      return undefined;
    }
    const out: TranscriptionLyricsVariants = { ...(v ?? {}) };
    if (legacy?.length && out.match === undefined) {
      out.match = legacy;
    }
    const hasAi = out.ai !== undefined && out.ai.length > 0;
    const hasMatch = out.match !== undefined && out.match.length > 0;
    if (!hasAi && !hasMatch) {
      return undefined;
    }
    return {
      ...(hasAi ? { ai: out.ai } : {}),
      ...(hasMatch ? { match: out.match } : {}),
    };
  }

  async create(dto: CreateTrackDto): Promise<TrackDocument> {
    await this.artistsService.findOne(dto.artistId);
    const resolvedLyricsVariants = this.resolveLyricsVariants(dto);
    const { artistId, lyrics, lyricsVariants, ...rest } = dto;
    void lyrics;
    void lyricsVariants;
    const doc = new this.trackModel({
      ...rest,
      ...(resolvedLyricsVariants
        ? { lyricsVariants: resolvedLyricsVariants }
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

  /** Atualização parcial de acordes / letras (sem verificação de dono — ativar JWT em produção). */
  async updateTranscriptionByTrackId(
    trackId: string,
    body: {
      chords?: unknown;
      lyricsVariants?: Partial<TranscriptionLyricsVariantsSubdoc>;
    },
  ): Promise<TrackDocument> {
    const track = await this.findByTrackId(trackId);
    if (body.chords !== undefined) {
      const durationSec = track.meta?.duration_seconds;
      track.chords = normalizeChordListFromClient(body.chords, durationSec);
      track.markModified('chords');
    }
    if (body.lyricsVariants !== undefined) {
      const cur = track.lyricsVariants ?? {};
      const next: TranscriptionLyricsVariantsSubdoc = { ...cur };
      if (body.lyricsVariants.ai !== undefined) {
        next.ai = body.lyricsVariants.ai as TranscriptionLyricsVariantsSubdoc['ai'];
      }
      if (body.lyricsVariants.match !== undefined) {
        next.match = body.lyricsVariants.match as TranscriptionLyricsVariantsSubdoc['match'];
      }
      track.lyricsVariants = next;
      track.markModified('lyricsVariants');
    }
    await track.save();
    return this.findByTrackId(trackId);
  }
}
