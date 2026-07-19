import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FootballController } from './football.controller';
import { FootballService } from './football.service';

@Module({
  imports: [PrismaModule],
  controllers: [FootballController],
  providers: [FootballService],
  exports: [FootballService],
})
export class FootballModule {}
