import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { TripsService } from './trips.service';
import { RequestTripDto } from './dtos/request-trip.dto';
import { UpdateTripStatusDto } from './dtos/update-trip-status.dto';
import { JwtAuthGuard } from '../../app/common/guards/jwt-auth.guard';
import { Roles, Role } from '../../app/common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../app/common/decorators/current-user.decorator';

@ApiTags('Trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post()
  @ApiOperation({ summary: 'Request a new ride/parcel trip (returns fare estimate)' })
  request(@CurrentUser() user: AuthUser, @Body() dto: RequestTripDto) {
    return this.trips.requestTrip(user.id, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: list all trips' })
  listAll() {
    return this.trips.listAll();
  }

  @Get('me')
  @ApiOperation({ summary: "List the authenticated user's recent trips" })
  list(@CurrentUser() user: AuthUser) {
    return this.trips.getActiveForCustomer(user.id);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Driver accepts a trip request' })
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.trips.acceptTrip(user.id, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update trip status (arriving / started / completed / cancelled)' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTripStatusDto,
  ) {
    return this.trips.updateStatus(user.id, id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a single trip' })
  get(@Param('id') id: string) {
    return this.trips.findOne(id);
  }
}
