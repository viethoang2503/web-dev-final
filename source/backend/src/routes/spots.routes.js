/**
 * Public catalogue endpoints (Technical Spec section 5).
 *
 *   GET /api/spots              all spots
 *   GET /api/spots?kind=food    Food only
 *   GET /api/spots?kind=place   Places only
 *   GET /api/spots/:id          one spot
 */
import { Router } from 'express';
import { ApiError, sendList, sendObject } from '../utils/http-response.js';
import { SPOT_KINDS, getSpotById, listSpots, getFilterOptions } from '../services/spots.service.js';

export const spotsRouter = Router();

spotsRouter.get('/', (req, res) => {
  const { kind } = req.query;

  if (kind !== undefined && !SPOT_KINDS.includes(kind)) {
    throw ApiError.validation(`kind must be one of: ${SPOT_KINDS.join(', ')}.`);
  }

  const spots = listSpots({ kind });
  return sendList(res, spots, {
    kind: kind ?? 'all',
    filters: getFilterOptions(kind),
  });
});

spotsRouter.get('/:id', (req, res) => {
  const spot = getSpotById(req.params.id);

  if (!spot) {
    throw ApiError.notFound(`No spot found with id "${req.params.id}".`);
  }

  return sendObject(res, spot);
});
