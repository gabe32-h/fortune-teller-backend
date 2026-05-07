import { Router } from 'express';
import { FortuneService } from '../services/fortune.service';
import { ResponseHandler } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { fortuneRequestSchema, fortuneHistoryQuerySchema } from '@fortune-teller/shared';

const router = Router();

// All fortune routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/fortunes:
 *   post:
 *     summary: Create a new fortune reading
 *     tags: [Fortunes]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', validateBody(fortuneRequestSchema), async (req: AuthRequest, res, next) => {
  try {
    // In a real implementation, this would call an AI service or fortune telling algorithm
    const fortune = await FortuneService.createFortune({
      userId: req.user!.userId,
      category: req.body.category,
      title: `${req.body.category} Fortune`,
      description: 'Your fortune reading',
      prediction: 'Sample prediction - integrate with AI service',
      luckyNumber: Math.floor(Math.random() * 100),
      luckyColor: 'red',
      luckyDirection: 'east',
      advice: 'Sample advice',
      score: Math.floor(Math.random() * 100),
    });
    ResponseHandler.created(res, fortune, 'Fortune created successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/fortunes:
 *   get:
 *     summary: Get user's fortune history
 *     tags: [Fortunes]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', validateQuery(fortuneHistoryQuerySchema), async (req: AuthRequest, res, next) => {
  try {
    const history = await FortuneService.getUserFortunes(req.user!.userId, {
      category: req.query.category as string | undefined,
      startDate: req.query.startDate as Date | undefined,
      endDate: req.query.endDate as Date | undefined,
      pagination: {
        page: Number(req.query.page) || 1,
        pageSize: Number(req.query.pageSize) || 20,
      },
    });
    ResponseHandler.success(res, history);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/fortunes/{id}:
 *   get:
 *     summary: Get fortune by ID
 *     tags: [Fortunes]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const fortune = await FortuneService.getFortuneById(req.params.id);
    if (!fortune) {
      return ResponseHandler.error(
        res,
        { code: 'NOT_FOUND', message: 'Fortune not found' },
        404
      );
    }
    ResponseHandler.success(res, fortune);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/fortunes/{id}:
 *   delete:
 *     summary: Delete fortune
 *     tags: [Fortunes]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await FortuneService.deleteFortune(req.params.id, req.user!.userId);
    ResponseHandler.noContent(res);
  } catch (error) {
    next(error);
  }
});

export default router;
