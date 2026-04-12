import { Transform, Type } from 'class-transformer';
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type {
  MusicTranscriptionPayload,
  TranscriptionLyricsVariants,
} from '../../domain/music-transcription.types';

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
  lyricsVariant?: string;

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

  /** Eventos de acorde no formato de chords.json */
  @IsOptional()
  chords?: MusicTranscriptionPayload['chords'];

  /** Variantes: `ai` (export AI/) e `match` (export Match/, letra por busca). */
  @IsOptional()
  lyricsVariants?: TranscriptionLyricsVariants;

  /** @deprecated Usar `lyricsVariants.match`. Mantido para payloads antigos. */
  @IsOptional()
  lyrics?: MusicTranscriptionPayload['lyrics'];

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
