import { prisma } from '../config/database';
import { CacheService } from '../config/redis';
import { CACHE_TTL, Fortune, FortuneHistory, PaginationParams } from '@fortune-teller/shared';

export class FortuneService {
  static async createFortune(data: {
    userId: string;
    category: string;
    title: string;
    description: string;
    prediction: string;
    luckyNumber?: number;
    luckyColor?: string;
    luckyDirection?: string;
    advice?: string;
    score?: number;
  }): Promise<Fortune> {
    const fortune = await prisma.fortune.create({
      data,
    });

    // Clear user's fortune cache
    await CacheService.delPattern(`fortune:user:${data.userId}:*`);

    return fortune as unknown as Fortune;
  }

  static async getFortuneById(fortuneId: string): Promise<Fortune | null> {
    const cacheKey = `fortune:${fortuneId}`;
    const cached = await CacheService.get<Fortune>(cacheKey);

    if (cached) {
      return cached;
    }

    const fortune = await prisma.fortune.findUnique({
      where: { id: fortuneId },
    });

    if (fortune) {
      await CacheService.set(cacheKey, fortune, CACHE_TTL.MEDIUM);
    }

    return fortune as unknown as Fortune;
  }

  static async getUserFortunes(
    userId: string,
    options: {
      category?: string;
      startDate?: Date;
      endDate?: Date;
      pagination: PaginationParams;
    }
  ): Promise<FortuneHistory> {
    const { category, startDate, endDate, pagination } = options;

    const where: {
      userId: string;
      category?: string;
      date?: { gte?: Date; lte?: Date };
    } = { userId };

    if (category) {
      where.category = category;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const [fortunes, total] = await Promise.all([
      prisma.fortune.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { date: 'desc' },
      }),
      prisma.fortune.count({ where }),
    ]);

    return {
      fortunes: fortunes as unknown as Fortune[],
      totalCount: total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  static async deleteFortune(fortuneId: string, userId: string): Promise<void> {
    await prisma.fortune.deleteMany({
      where: {
        id: fortuneId,
        userId,
      },
    });

    await CacheService.del(`fortune:${fortuneId}`);
    await CacheService.delPattern(`fortune:user:${userId}:*`);
  }
}
