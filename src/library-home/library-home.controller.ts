import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { LibraryHomeService } from './library-home.service';

@Controller('library-home')
export class LibraryHomeController {
  constructor(private readonly libraryHomeService: LibraryHomeService) {}

  /** Busca por nome da faixa ou do artista (`search`). Paginação opcional (`page`, `limit`). */
  @Get('search')
  searchTracks(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = Number.parseInt(page ?? '', 10);
    const parsedLimit = Number.parseInt(limit ?? '', 10);
    const safePage =
      Number.isFinite(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10_000) : 1;
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 12;
    return this.libraryHomeService.searchTracks({
      search: search ?? '',
      page: safePage,
      limit: safeLimit,
    });
  }

  @Get()
  getHomeFeed(
    @Query('userId') userId?: string,
    @Query('recommendedLimit') recommendedLimit?: string,
    @Query('recentLimit') recentLimit?: string,
  ) {
    const parsedRecommendedLimit = Number.parseInt(recommendedLimit ?? '', 10);
    const parsedRecentLimit = Number.parseInt(recentLimit ?? '', 10);
    const safeRecommendedLimit =
      Number.isFinite(parsedRecommendedLimit) && parsedRecommendedLimit > 0
        ? Math.min(parsedRecommendedLimit, 30)
        : 12;
    const safeRecentLimit =
      Number.isFinite(parsedRecentLimit) && parsedRecentLimit > 0
        ? Math.min(parsedRecentLimit, 30)
        : 8;
    return this.libraryHomeService.getHomeFeed({
      userId,
      recommendedLimit: safeRecommendedLimit,
      recentLimit: safeRecentLimit,
    });
  }

  @Post('access')
  async registerAccess(@Body() body: { userId?: string; trackId?: string }) {
    if (!body.userId || !body.trackId) {
      return { ok: true };
    }
    await this.libraryHomeService.registerTrackAccess({
      userId: body.userId,
      trackId: body.trackId,
    });
    return { ok: true };
  }

  @Post('access/by-track-key')
  async registerAccessByTrackKey(
    @Body() body: { userId?: string; trackKey?: string },
  ) {
    if (!body.userId || !body.trackKey) {
      return { ok: true };
    }
    await this.libraryHomeService.registerTrackAccessByKey({
      userId: body.userId,
      trackKey: body.trackKey,
    });
    return { ok: true };
  }
}
