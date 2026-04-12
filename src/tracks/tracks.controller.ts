import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tracksService.findOne(id);
  }
}
