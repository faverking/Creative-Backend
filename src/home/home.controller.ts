import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { HomeApplicationService } from './application/home.application';

@Controller('home')
export class HomeController {
  constructor(private readonly homeApplicationService: HomeApplicationService) {}

  @Public()
  @Get()
  getHome() {
    return this.homeApplicationService.getHome();
  }
}
