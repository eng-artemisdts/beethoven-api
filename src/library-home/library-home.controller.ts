import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { LibraryHomeService } from './library-home.service';

@Controller('library-home')
export class LibraryHomeController {
  constructor(private readonly libraryHomeService: LibraryHomeService) {}

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
