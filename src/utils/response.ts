import { Response } from 'express';
import { ApiResponse, ApiError } from '@fortune-teller/shared';
import { HTTP_STATUS } from '@fortune-teller/shared';

export class ResponseHandler {
  static success<T>(res: Response, data: T, message?: string, statusCode = HTTP_STATUS.OK) {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    error: ApiError,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR
  ) {
    const response: ApiResponse = {
      success: false,
      error,
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T, message?: string) {
    this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  static noContent(res: Response) {
    res.status(HTTP_STATUS.NO_CONTENT).send();
  }
}
