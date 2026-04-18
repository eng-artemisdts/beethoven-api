import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Track } from '../../tracks/schemas/track.schema';

export type LibraryTrackAccessDocument = HydratedDocument<LibraryTrackAccess>;

@Schema({ collection: 'library_track_accesses', timestamps: true })
export class LibraryTrackAccess {
  /** `sub` do Auth0 do dono do histórico. */
  @Prop({ required: true, trim: true, index: true })
  userId: string;

  @Prop({ type: Types.ObjectId, ref: Track.name, required: true, index: true })
  trackId: Types.ObjectId;

  @Prop({ default: 1 })
  accessCount?: number;

  @Prop({ default: Date.now })
  firstAccessAt?: Date;

  @Prop({ default: Date.now, index: true })
  lastAccessAt?: Date;
}

export const LibraryTrackAccessSchema =
  SchemaFactory.createForClass(LibraryTrackAccess);

LibraryTrackAccessSchema.index({ userId: 1, trackId: 1 }, { unique: true });
LibraryTrackAccessSchema.index({ userId: 1, lastAccessAt: -1 });
