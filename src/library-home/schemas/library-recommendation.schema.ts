import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Track } from '../../tracks/schemas/track.schema';

export type LibraryRecommendationDocument = HydratedDocument<LibraryRecommendation>;

@Schema({ collection: 'library_recommendations', timestamps: true })
export class LibraryRecommendation {
  @Prop({ type: Types.ObjectId, ref: Track.name, required: true, index: true })
  trackId: Types.ObjectId;

  /** `sub` do Auth0. Quando ausente, vale para todos os utilizadores. */
  @Prop({ trim: true, index: true })
  userId?: string;

  @Prop({ trim: true, default: 'editorial' })
  source?: string;

  @Prop({ default: 0 })
  score?: number;

  @Prop({ default: true, index: true })
  isActive?: boolean;

  @Prop()
  startsAt?: Date;

  @Prop()
  endsAt?: Date;
}

export const LibraryRecommendationSchema =
  SchemaFactory.createForClass(LibraryRecommendation);

LibraryRecommendationSchema.index({ userId: 1, isActive: 1, score: -1 });
