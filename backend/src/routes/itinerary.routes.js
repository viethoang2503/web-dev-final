/**
 * My Day endpoints (DAY-02).
 *
 *   GET    /api/itinerary             load the plan
 *   POST   /api/itinerary/items       add a spot to a slot
 *   PATCH  /api/itinerary/items/:id   change slot and/or position
 *   DELETE /api/itinerary/items/:id   remove one item
 *   DELETE /api/itinerary             clear the whole day
 *
 * All behind requireAuth. Item ids are checked against the session's user, so
 * one account can never touch another account's plan.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { ApiError, sendObject } from '../utils/http-response.js';
import {
  addItem,
  getItinerary,
  moveItem,
  removeItem,
  resetItinerary,
} from '../services/itinerary.service.js';

export const itineraryRouter = Router();

itineraryRouter.use(requireAuth);

itineraryRouter.get('/', (req, res) => {
  return sendObject(res, getItinerary(req.user.id));
});

itineraryRouter.post('/items', (req, res) => {
  const { spotId, timeSlot } = req.body ?? {};

  if (typeof spotId !== 'string' || spotId.length === 0) {
    throw ApiError.validation('spotId is required.', { spotId: 'Choose a place or dish.' });
  }

  const added = addItem(req.user.id, { spotId, timeSlot });

  // The whole plan comes back so the drawer never has to guess the new state.
  return sendObject(res, { added, ...getItinerary(req.user.id) }, 201);
});

itineraryRouter.patch('/items/:id', (req, res) => {
  const { timeSlot, position } = req.body ?? {};

  if (timeSlot === undefined && position === undefined) {
    throw ApiError.validation('Send timeSlot, position, or both.');
  }

  const moved = moveItem(req.user.id, req.params.id, { timeSlot, position });

  return sendObject(res, { moved, ...getItinerary(req.user.id) });
});

itineraryRouter.delete('/items/:id', (req, res) => {
  const removed = removeItem(req.user.id, req.params.id);
  return sendObject(res, { removed, ...getItinerary(req.user.id) });
});

itineraryRouter.delete('/', (req, res) => {
  // Reset is destructive, so the client must say so on purpose. The UI asks for
  // confirmation first (DAY-05); this is the second lock.
  if (req.body?.confirm !== true) {
    throw ApiError.validation('Send { "confirm": true } to clear the whole day.', {
      confirm: 'Confirmation is required.',
    });
  }

  const result = resetItinerary(req.user.id);
  return sendObject(res, { ...result, ...getItinerary(req.user.id) });
});
