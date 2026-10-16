import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArtistsModule } from '../artists/artists.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import {
  LibraryTrackAccess,
  LibraryTrackAccessSchema,
} from '../library-home/schemas/library-track-access.schema';
import { Track, TrackSchema } from './schemas/track.schema';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';

@Module({
  imports: [
    AuthModule,
    ArtistsModule,
    MongooseModule.forFeature([
      { name: Track.name, schema: TrackSchema },
      { name: LibraryTrackAccess.name, schema: LibraryTrackAccessSchema },
    ]),
  ],
  controllers: [TracksController],
  providers: [TracksService, JwtAuthGuard, OptionalJwtAuthGuard],
})
export class TracksModule {}
