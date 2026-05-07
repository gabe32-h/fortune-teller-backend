import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { JwtService } from '../utils/jwt';
import { AppError } from '../middleware/error.middleware';
import { ERROR_CODES, HTTP_STATUS, AuthResponse, UserCredentials } from '@fortune-teller/shared';

export class AuthService {
  static async register(data: {
    email: string;
    username: string;
    password: string;
    phoneNumber?: string;
  }): Promise<AuthResponse> {
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        phoneNumber: data.phoneNumber,
      },
    });

    // Generate tokens
    const accessToken = JwtService.generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshToken = JwtService.generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: {
        ...userWithoutPassword,
        preferences: {
          language: user.language as 'zh-CN' | 'zh-TW' | 'en',
          timezone: user.timezone,
          notifications: user.notifications,
        },
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes
      },
    };
  }

  static async login(credentials: UserCredentials): Promise<AuthResponse> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
    });

    if (!user) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS,
        'Invalid email or password'
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

    if (!isPasswordValid) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS,
        'Invalid email or password'
      );
    }

    // Generate tokens
    const accessToken = JwtService.generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshToken = JwtService.generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: {
        ...userWithoutPassword,
        preferences: {
          language: user.language as 'zh-CN' | 'zh-TW' | 'en',
          timezone: user.timezone,
          notifications: user.notifications,
        },
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900,
      },
    };
  }

  static async refreshToken(token: string): Promise<{ accessToken: string; expiresIn: number }> {
    // Verify refresh token
    const payload = JwtService.verifyRefreshToken(token);

    // Check if token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.TOKEN_EXPIRED,
        'Refresh token expired or invalid'
      );
    }

    // Generate new access token
    const accessToken = JwtService.generateAccessToken({
      userId: payload.userId,
      email: payload.email,
    });

    return {
      accessToken,
      expiresIn: 900,
    };
  }

  static async logout(token: string): Promise<void> {
    await prisma.refreshToken.delete({
      where: { token },
    });
  }
}
