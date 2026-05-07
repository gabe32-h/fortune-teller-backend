import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { ResponseHandler } from '../utils/response';
import { validateBody } from '../middleware/validation.middleware';
import { userRegistrationSchema, userCredentialsSchema } from '@fortune-teller/shared';
import { z } from 'zod';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 */
router.post('/register', validateBody(userRegistrationSchema), async (req, res, next) => {
  try {
    const result = await AuthService.register(req.body);
    ResponseHandler.created(res, result, 'User registered successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 */
router.post('/login', validateBody(userCredentialsSchema), async (req, res, next) => {
  try {
    const result = await AuthService.login(req.body);
    ResponseHandler.success(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 */
router.post(
  '/refresh',
  validateBody(z.object({ refreshToken: z.string() })),
  async (req, res, next) => {
    try {
      const result = await AuthService.refreshToken(req.body.refreshToken);
      ResponseHandler.success(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 */
router.post(
  '/logout',
  validateBody(z.object({ refreshToken: z.string() })),
  async (req, res, next) => {
    try {
      await AuthService.logout(req.body.refreshToken);
      ResponseHandler.success(res, null, 'Logout successful');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
