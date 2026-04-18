import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
  private resolveLyricsPayload(dto: CreateTrackDto): {
    lyrics: TranscriptionLyricSegmentSubdoc[];
    lyricsSource: LyricsSource;
  } | undefined {
    const newLyrics = dto.lyrics;
    const newSource = dto.lyricsSource;
    if (newLyrics !== undefined && newLyrics.length > 0) {
      const source: LyricsSource = newSource ?? 'MATCH';
      return { lyrics: newLyrics as TranscriptionLyricSegmentSubdoc[], lyricsSource: source };
    }

    return undefined;
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
}
