import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../shared/types';

@ApiTags('Dashboard')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('organization/dashboard')
  @Roles('ORGANIZATION', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get real organization dashboard metrics, events, review queue, and students' })
  async getOrganizationDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getOrganizationDashboard(user.userId, user.role);
  }

  @Get('admin/dashboard')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get real system-wide admin console metrics, audit logs, organizations, and events' })
  async getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }
}
