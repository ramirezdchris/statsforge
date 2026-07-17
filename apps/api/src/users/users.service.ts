import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InviteUserDto } from './dto/invite-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        telegramUsername: true,
        invitedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async invite(invitedById: string, dto: InviteUserDto) {
    if (dto.role === Role.ADMIN) {
      throw new BadRequestException('Admins cannot be invited from this flow');
    }

    const email = dto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        role: dto.role,
        passwordHash,
        mustChangePassword: true,
        invitedById,
        invitedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        invitedAt: true,
        createdAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: invitedById,
        action: 'INVITE_USER',
        metadata: JSON.stringify({ invitedUserId: user.id, email, role: dto.role }),
      },
    });

    return { user, temporaryPassword };
  }

  private generateTemporaryPassword(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const groups = Array.from({ length: 3 }, () =>
      Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(''),
    );

    return groups.join('-');
  }
}
