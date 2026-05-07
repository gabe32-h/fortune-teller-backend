import { Router } from 'express';
import { UserService } from '../services/user.service';
import { ResponseHandler } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { updateUserProfileSchema } from '@fortune-teller/shared';

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const user = await UserService.getUserById(req.user!.userId);
    ResponseHandler.success(res, user);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/users/me:
 *   patch:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/me',
  validateBody(updateUserProfileSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const user = await UserService.updateUser(req.user!.userId, req.body);
      ResponseHandler.success(res, user, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/users/me:
 *   delete:
 *     summary: Delete current user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/me', async (req: AuthRequest, res, next) => {
  try {
    await UserService.deleteUser(req.user!.userId);
    ResponseHandler.noContent(res);
  } catch (error) {
    next(error);
  }
});

export default router;
