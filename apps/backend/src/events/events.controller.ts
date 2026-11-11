import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/events.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../shared/types';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'ORGANIZATION', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all accessible events' })
  async listEvents() {
    return this.eventsService.listEvents();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZATION', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new event' })
  async createEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.createEvent(user.userId, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'ORGANIZATION', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get details of a specific event' })
  async getEvent(@Param('id') id: string) {
    return this.eventsService.getEventDetails(id);
  }
}
