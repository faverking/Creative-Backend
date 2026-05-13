import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

interface HealthResponse {
  status: 'ok';
  service: 'mononest-api';
  uptime: number;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'mononest-api',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
