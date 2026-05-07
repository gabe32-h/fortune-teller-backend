import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../utils/jwt';
import { AppError } from './error.middleware';
import { ERROR_CODES, HTTP_STATUS } from '@fortune-teller/shared';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED,
        'No token provided'
      );
    }

    const token = authHeader.split(' ')[1];
    const payload = JwtService.verifyAccessToken(token);

    req.user = {
      userId: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error) {
    next(error);
  }
}
