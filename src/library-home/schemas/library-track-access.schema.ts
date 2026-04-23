import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Track } from '../../tracks/schemas/track.schema';

export type LibraryTrackAccessDocument = HydratedDocument<LibraryTrackAccess>;

@Schema({ collection: 'library_track_accesses', timestamps: true })
export class LibraryTrackAccess {
  /** `sub` do Auth0 do dono do histórico. */
  @Prop({ required: true, trim: true, index: true })
  userId: string;

  /**
   * Chave de faixa alinhada a Schubert / `Track.trackId` (ex.: pasta em media/transcriptions).
   * Permite registar acessos mesmo quando o documento ainda não existe na coleção `tracks` do Beethoven.
   */
  @Prop({ trim: true, sparse: true, index: true })
  trackKey?: string;

  @Prop({ type: Types.ObjectId, ref: Track.name, sparse: true, index: true })
  trackId?: Types.ObjectId;

  @Prop({ default: 1 })
  accessCount?: number;

  @Prop({ default: Date.now })
  firstAccessAt?: Date;

  @Prop({ default: Date.now, index: true })
  lastAccessAt?: Date;
}

export const LibraryTrackAccessSchema =
  SchemaFactory.createForClass(LibraryTrackAccess);

/** Uma entrada por utilizador e faixa (identificador Schubert). */
LibraryTrackAccessSchema.index(
  { userId: 1, trackKey: 1 },
  { unique: true, sparse: true },
);
LibraryTrackAccessSchema.index({ userId: 1, lastAccessAt: -1 });
