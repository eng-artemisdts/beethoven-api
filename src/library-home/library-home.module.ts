import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Track, TrackSchema } from '../tracks/schemas/track.schema';
import { LibraryHomeController } from './library-home.controller';
import { LibraryHomeService } from './library-home.service';
import {
  LibraryRecommendation,
  LibraryRecommendationSchema,
} from './schemas/library-recommendation.schema';
import {
  LibraryTrackAccess,
  LibraryTrackAccessSchema,
} from './schemas/library-track-access.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Track.name, schema: TrackSchema },
      { name: LibraryRecommendation.name, schema: LibraryRecommendationSchema },
      { name: LibraryTrackAccess.name, schema: LibraryTrackAccessSchema },
    ]),
  ],
  controllers: [LibraryHomeController],
  providers: [LibraryHomeService],
})
export class LibraryHomeModule {}
