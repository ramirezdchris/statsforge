import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      name: 'StatsForge API',
      status: 'ok',
    };
  }
}
