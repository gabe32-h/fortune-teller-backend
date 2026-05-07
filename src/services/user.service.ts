import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { ERROR_CODES, HTTP_STATUS, UserProfile } from '@fortune-teller/shared';

export class UserService {
  static async getUserById(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, 'User not found');
    }

    const { password: _, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      preferences: {
        language: user.language as 'zh-CN' | 'zh-TW' | 'en',
        timezone: user.timezone,
        notifications: user.notifications,
      },
    };
  }

  static async updateUser(
    userId: string,
    data: Partial<{
      username: string;
      phoneNumber: string;
      birthDate: Date;
      birthTime: string;
      birthPlace: string;
      gender: string;
      avatarUrl: string;
      language: string;
      timezone: string;
      notifications: boolean;
    }>
  ): Promise<UserProfile> {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      preferences: {
        language: user.language as 'zh-CN' | 'zh-TW' | 'en',
        timezone: user.timezone,
        notifications: user.notifications,
      },
    };
  }

  static async deleteUser(userId: string): Promise<void> {
    await prisma.user.delete({
      where: { id: userId },
    });
  }
}
