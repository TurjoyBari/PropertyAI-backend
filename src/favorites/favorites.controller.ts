import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { FavoritesService } from './favorites.service';
import { IsString, MinLength } from 'class-validator';

class AddFavoriteDto {
  @IsString()
  @MinLength(1)
  propertyId: string;
}

@Controller('api/favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  list(@Session() session: UserSession) {
    return this.favoritesService.list(session.user.id);
  }

  @Post()
  add(@Body() dto: AddFavoriteDto, @Session() session: UserSession) {
    return this.favoritesService.add(session.user.id, dto.propertyId);
  }

  @Delete(':propertyId')
  remove(
    @Param('propertyId') propertyId: string,
    @Session() session: UserSession,
  ) {
    return this.favoritesService.remove(session.user.id, propertyId);
  }
}
