/**
 * API router. Every route added in later phases mounts here, so backend/src/server.js
 * never needs to change again.
 */
import { Router } from 'express';
import { spotsRouter } from './spots.routes.js';
import { authRouter } from './auth.routes.js';
import { favoritesRouter } from './favorites.routes.js';
import { itineraryRouter } from './itinerary.routes.js';
import { attachUser } from '../middleware/auth.middleware.js';

export const apiRouter = Router();

// Small readiness endpoint, useful for QA and the benchmark task.
apiRouter.get('/health', (req, res) => {
  res.json({ data: { status: 'ok', time: new Date().toISOString() } });
});

// req.user is available to every route below: the signed-in user or null.
apiRouter.use(attachUser);

apiRouter.use('/spots', spotsRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/favorites', favoritesRouter);
apiRouter.use('/itinerary', itineraryRouter);
