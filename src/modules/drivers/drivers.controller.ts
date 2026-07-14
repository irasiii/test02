import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DriversService } from './drivers.service';
import { CreateVehicleDto } from './dtos/create-vehicle.dto';
import { UpdateLocationDto } from './dtos/update-location.dto';
import { UpdateDriverDto } from './dtos/update-driver.dto';
import { JwtAuthGuard } from '../../app/common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../app/common/decorators/current-user.decorator';
import { Roles, Role } from '../../app/common/decorators/roles.decorator';

@ApiTags('Drivers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drivers')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own driver profile' })
  me(@CurrentUser() user: AuthUser) {
    return this.drivers.findByUserId(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update driver status / type' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateDriverDto) {
    return this.drivers.update(user.id, dto);
  }

  @Post('me/online')
  @ApiOperation({ summary: 'Mark driver online & start broadcasting location' })
  online(@CurrentUser() user: AuthUser) {
    return this.drivers.goOnline(user.id);
  }

  @Post('me/offline')
  @ApiOperation({ summary: 'Mark driver offline' })
  offline(@CurrentUser() user: AuthUser) {
    return this.drivers.goOffline(user.id);
  }

  @Post('me/ping')
  @ApiOperation({ summary: 'Update driver live location (call every 5-10s)' })
  ping(@CurrentUser() user: AuthUser, @Body() dto: UpdateLocationDto) {
    return this.drivers.pingLocation(user.id, dto);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Find drivers within radius (for ride-hailing UI map)' })
  nearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radiusKm') radiusKm = 5,
    @Query('count') count = 10,
  ) {
    return this.drivers.nearby(lat, lng, radiusKm, count);
  }

  // Vehicles ---------------------------------------------------------------

  @Post('me/vehicles')
  @ApiOperation({ summary: 'Register a new vehicle' })
  addVehicle(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleDto) {
    return this.drivers.addVehicle(user.id, dto);
  }

  @Get('me/vehicles')
  @ApiOperation({ summary: 'List own vehicles' })
  listVehicles(@CurrentUser() user: AuthUser) {
    return this.drivers.listVehicles(user.id);
  }

  @Patch('me/vehicles/:id/verify')
  @ApiOperation({ summary: 'Self-verify vehicle (in production require admin/doc upload)' })
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.drivers.verifyVehicle(user.id, id);
  }

  // Admin ------------------------------------------------------------------

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] List all drivers' })
  list() {
    return this.drivers.list();
  }
}
