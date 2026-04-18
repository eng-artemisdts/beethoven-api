import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { LyricsSource, MusicTranscriptionPayload } from '../../domain/music-transcription.types';

class MusicTranscriptionMetaDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sourcePathParam?: string;

  @IsOptional()
  @IsString()
  trackId?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsNumber()
  duration_seconds?: number;
}

export class CreateTrackDto {
  @IsMongoId()
  artistId: string;

  @IsOptional()
  @IsString()
  trackId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    const s = String(value).trim();
    return s === '' ? undefined : s;
  })
  @IsString()
  spotifyId?: string;

  @IsOptional()
  @IsString()
  standard_tune?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  original_tune?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  capo_at?: number;

  @IsOptional()
  @IsBoolean()
  is_private?: boolean;

  /** Eventos de acorde no formato de chords.json */
  @IsOptional()
  chords?: MusicTranscriptionPayload['chords'];

  /** Segmentos de letra sincronizada. */
  @IsOptional()
  lyrics?: MusicTranscriptionPayload['lyrics'];

  /** Origem da letra: transcrição IA ou alinhamento por match (LRCLIB / busca). */
  @IsOptional()
  @IsIn(['AI', 'MATCH'])
  lyricsSource?: LyricsSource;

  @IsOptional()
  sections?: MusicTranscriptionPayload['sections'];

  @IsOptional()
  @ValidateNested()
  @Type(() => MusicTranscriptionMetaDto)
  meta?: MusicTranscriptionPayload['meta'];

  @IsOptional()
  @IsNumber()
  chordTimeOffsetSec?: number;
}
