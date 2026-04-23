import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LibraryHomeService } from './library-home.service';

@Controller('library-home')
export class LibraryHomeController {
  constructor(private readonly libraryHomeService: LibraryHomeService) {}

  private resolveUserSub(req: Request): string {
    const user = req.user as { sub?: unknown } | undefined;
    return typeof user?.sub === 'string' ? user.sub.trim() : '';
  }

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
      Number.isFinite(parsedPage) && parsedPage > 0
        ? Math.min(parsedPage, 10_000)
        : 1;
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 50)
        : 12;
    return this.libraryHomeService.searchTracks({
      search: search ?? '',
      page: safePage,
      limit: safeLimit,
    });
  }

  @Get('catalog')
  getCatalog(
    @Query('userId') userId?: string,
    @Query('tab') tab?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number.parseInt(limit ?? '', 10);
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 300)
        : 120;
    const normalizedTab =
      tab === 'artistas' || tab === 'albuns' || tab === 'playlists'
        ? tab
        : 'musicas';
    return this.libraryHomeService.listCatalog({
      userId,
      tab: normalizedTab,
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

  @Post('saved/by-track-key')
  async saveByTrackKey(@Body() body: { userId?: string; trackKey?: string }) {
    if (!body.userId || !body.trackKey) {
      return { ok: true };
    }
    await this.libraryHomeService.saveTrackByKey({
      userId: body.userId,
      trackKey: body.trackKey,
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('access/by-track-key/:trackKey')
  async removeAccessByTrackKey(
    @Req() req: Request,
    @Param('trackKey') trackKey: string,
  ) {
    const userId = this.resolveUserSub(req);
    if (!userId) {
      throw new UnauthorizedException('Sessão inválida: sub ausente.');
    }
    await this.libraryHomeService.unregisterTrackAccessByKey({
      userId,
      trackKey,
    });
    return { ok: true };
  }
}
