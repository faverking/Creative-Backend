import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../common/constants/roles';

@Controller('admin')
export class AdminController {
  @Get('ping')
  @Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
  ping() {
    return {
      module: 'admin',
      status: 'scaffolded',
    };
  }
}
