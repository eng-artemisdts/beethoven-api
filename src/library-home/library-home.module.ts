import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Artist, ArtistSchema } from '../artists/schemas/artist.schema';
import { Track, TrackSchema } from '../tracks/schemas/track.schema';
import { LibraryHomeController } from './library-home.controller';
import { LibraryHomeService } from './library-home.service';
import {
  LibraryTrackAccess,
  LibraryTrackAccessSchema,
} from './schemas/library-track-access.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Track.name, schema: TrackSchema },
      { name: LibraryTrackAccess.name, schema: LibraryTrackAccessSchema },
      { name: Artist.name, schema: ArtistSchema },
    ]),
  ],
  controllers: [LibraryHomeController],
  providers: [LibraryHomeService],
})
export class LibraryHomeModule {}
