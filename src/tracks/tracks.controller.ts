import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateTrackDto } from './dto/create-track.dto';
import { TracksService } from './tracks.service';

@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Post()
  create(@Body() dto: CreateTrackDto) {
    return this.tracksService.create(dto);
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

  @Patch('by-track-id/:trackId')
  patchByTrackId(
    @Param('trackId') trackId: string,
    @Body() body: { chords?: unknown; lyricsVariants?: Record<string, unknown> },
  ) {
    return this.tracksService.updateTranscriptionByTrackId(trackId, {
      chords: body.chords,
      lyricsVariants: body.lyricsVariants,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tracksService.findOne(id);
  }
}
