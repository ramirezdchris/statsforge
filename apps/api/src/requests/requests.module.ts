import { Module } from '@nestjs/common';
import { FootballModule } from '../football/football.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [PrismaModule, FootballModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
