import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { LyricsSource } from '../domain/music-transcription.types';
import { CreateTrackDto } from './dto/create-track.dto';
import { TracksService } from './tracks.service';

@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  private resolveUserSub(req: Request): string {
    const user = req.user as { sub?: unknown } | undefined;
    return typeof user?.sub === 'string' ? user.sub.trim() : '';
  }

  @Post()
  create(@Body() dto: CreateTrackDto) {
    return this.tracksService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('variations/from-schubert-track')
  createVariationFromSchubertTrack(
    @Req() req: Request,
    @Body()
    body: {
      baseTrackId?: unknown;
      baseArtistSlug?: unknown;
      baseSongSlug?: unknown;
      sourceTrack?: unknown;
      variationLabel?: unknown;
      is_private?: unknown;
    },
  ) {
    const ownerSub = this.resolveUserSub(req);
    if (!ownerSub) {
      throw new UnauthorizedException('Sessão inválida: sub ausente.');
    }
    return this.tracksService.createVariationFromSchubertTrack(ownerSub, body);
  }

  @Get()
  findAll(@Query('artistId') artistId?: string) {
    return this.tracksService.findAll(artistId);
  }

  /** Lookup pelo slug da pasta (ex.: whistle). */
  @Get('by-track-id/:trackId')
  findByTrackId(@Param('trackId') trackId: string) {
    return this.tracksService.findByTrackId(trackId);
  }

  @Get('variations/by-track-id/:trackId')
  findVariationByTrackId(
    @Param('trackId') trackId: string,
    @Req() req: Request,
  ) {
    const viewerSub = this.resolveUserSub(req) || undefined;
    return this.tracksService.findVariationByTrackId(trackId, viewerSub);
  }

  @Get('variations/by-base-key/:baseTrackId')
  findVariationsByBaseKey(
    @Param('baseTrackId') baseTrackId: string,
    @Req() req: Request,
  ) {
    const viewerSub = this.resolveUserSub(req) || undefined;
    return this.tracksService.findVariationsByBaseTrackId(
      baseTrackId,
      viewerSub,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('variations/my/by-base-key/:baseTrackId')
  findMyVariationByBaseKey(
    @Param('baseTrackId') baseTrackId: string,
    @Req() req: Request,
  ) {
    const ownerSub = this.resolveUserSub(req);
    if (!ownerSub) {
      throw new UnauthorizedException('Sessão inválida: sub ausente.');
    }
    return this.tracksService.findMyVariationByBaseTrackId(
      baseTrackId,
      ownerSub,
    );
  }

  @Patch('by-track-id/:trackId')
  patchByTrackId(
    @Param('trackId') trackId: string,
    @Body()
    body: {
      chords?: unknown;
      lyrics?: unknown;
      lyricsSource?: LyricsSource;
    },
  ) {
    return this.tracksService.updateTranscriptionByTrackId(trackId, {
      chords: body.chords,
      lyrics: body.lyrics,
      lyricsSource: body.lyricsSource,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('variations/by-track-id/:trackId')
  patchVariationByTrackId(
    @Req() req: Request,
    @Param('trackId') trackId: string,
    @Body()
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
  ) {
    const ownerSub = this.resolveUserSub(req);
    if (!ownerSub) {
      throw new UnauthorizedException('Sessão inválida: sub ausente.');
    }
    return this.tracksService.updateVariationByTrackId(ownerSub, trackId, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tracksService.findOne(id);
  }
}
