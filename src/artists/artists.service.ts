import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { rethrowAsConflictIfDuplicateKey } from '../common/mongo-duplicate-key';
import { CreateArtistDto } from './dto/create-artist.dto';
import { Artist, ArtistDocument } from './schemas/artist.schema';

@Injectable()
export class ArtistsService {
  constructor(
    @InjectModel(Artist.name)
    private readonly artistModel: Model<ArtistDocument>,
  ) {}

  async create(dto: CreateArtistDto): Promise<ArtistDocument> {
    const doc = new this.artistModel(dto);
    try {
      return await doc.save();
    } catch (e) {
      rethrowAsConflictIfDuplicateKey(e, 'artist');
    }
  }

  async findAll(): Promise<ArtistDocument[]> {
    return this.artistModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<ArtistDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Artista ${id} não encontrado`);
    }
    const artist = await this.artistModel.findById(id).exec();
    if (!artist) {
      throw new NotFoundException(`Artista ${id} não encontrado`);
    }
    return artist;
  }
}
