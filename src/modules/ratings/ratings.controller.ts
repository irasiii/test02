import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dtos/create-rating.dto';
import { JwtAuthGuard } from '../../app/common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../app/common/decorators/current-user.decorator';
import { RatingTarget } from './entities/rating.entity';

@ApiTags('Ratings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a rating (driver / restaurant / item)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRatingDto) {
    return this.ratings.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List ratings for a target (driver / restaurant)' })
  list(@Query('target') target: RatingTarget, @Query('targetId') targetId: string) {
    return this.ratings.findByTarget(target, targetId);
  }

  @Get('me')
  @ApiOperation({ summary: 'List ratings the user submitted' })
  listMine(@CurrentUser() user: AuthUser) {
    return this.ratings.findByReviewer(user.id);
  }
}
