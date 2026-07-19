import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MarketsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.market.findMany({
      where: { isEnabled: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }
}
