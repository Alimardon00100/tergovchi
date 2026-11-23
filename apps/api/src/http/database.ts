import { mediaUrl } from './media.service';
import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { User } from '@prisma/client';
import { publicUserSchema } from '@detective/shared';

@Injectable()
export class Database extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export function publicUser(
  user: Pick<
    User,
    'id' | 'email' | 'displayName' | 'role' | 'points' | 'rankName' | 'createdAt' | 'avatarKey'
  >,
) {
  return publicUserSchema.parse({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    points: user.points,
    rankName: user.rankName,
    avatarUrl: mediaUrl(user.avatarKey),
    createdAt: user.createdAt.toISOString(),
  });
}
