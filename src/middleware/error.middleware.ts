import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ERROR_CODES, HTTP_STATUS } from '@fortune-teller/shared';
import { ResponseHandler } from '../utils/response';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  logger.error(`Error: ${err.message}`, { error: err, path: req.path });

  // Zod validation errors
  if (err instanceof ZodError) {
    return ResponseHandler.error(
      res,
      {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: { errors: err.errors },
      },
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return ResponseHandler.error(
        res,
        {
          code: ERROR_CODES.ALREADY_EXISTS,
          message: 'Resource already exists',
          details: { field: err.meta?.target },
        },
        HTTP_STATUS.CONFLICT
      );
    }
    if (err.code === 'P2025') {
      return ResponseHandler.error(
        res,
        {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Resource not found',
        },
        HTTP_STATUS.NOT_FOUND
      );
    }
  }

  // Application errors
  if (err instanceof AppError) {
    return ResponseHandler.error(
      res,
      {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      err.statusCode
    );
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ResponseHandler.error(
      res,
      {
        code: ERROR_CODES.TOKEN_INVALID,
        message: 'Invalid token',
      },
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  if (err.name === 'TokenExpiredError') {
    return ResponseHandler.error(
      res,
      {
        code: ERROR_CODES.TOKEN_EXPIRED,
        message: 'Token expired',
      },
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  // Default error
  ResponseHandler.error(
    res,
    {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: err.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
    HTTP_STATUS.INTERNAL_SERVER_ERROR
  );
}

export function notFoundHandler(req: Request, res: Response) {
  ResponseHandler.error(
    res,
    {
      code: ERROR_CODES.NOT_FOUND,
      message: `Route ${req.originalUrl} not found`,
    },
    HTTP_STATUS.NOT_FOUND
  );
}
