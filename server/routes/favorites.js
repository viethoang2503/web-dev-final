/**
 * Favorite endpoints (FAV-02).
 *
 *   GET    /api/favorites            the current user's saved spots
 *   POST   /api/favorites/:spotId    save one
 *   DELETE /api/favorites/:spotId    remove one
 *
 * Every route sits behind requireAuth, so a guest gets 401 rather than an
 * empty list, and the user id is read from the session.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { sendList, sendObject } from '../services/respond.js';
import {
  addFavorite,
  countFavorites,
  listFavoriteIds,
  listFavorites,
  removeFavorite,
} from '../services/favorites.service.js';

export const favoritesRouter = Router();

favoritesRouter.use(requireAuth);

favoritesRouter.get('/', (req, res) => {
  const favorites = listFavorites(req.user.id);
  return sendList(res, favorites, {
    // ids let the frontend sync every heart on the page in one pass
    ids: favorites.map((spot) => spot.id),
    food: favorites.filter((spot) => spot.kind === 'food').length,
    places: favorites.filter((spot) => spot.kind === 'place').length,
  });
});

favoritesRouter.post('/:spotId', (req, res) => {
  const { spot, created } = addFavorite(req.user.id, req.params.spotId);

  return sendObject(
    res,
    {
      spot,
      favorite: true,
      // false means it was already saved, which the UI treats as success
      created,
      count: countFavorites(req.user.id),
      ids: listFavoriteIds(req.user.id),
    },
    created ? 201 : 200
  );
});

favoritesRouter.delete('/:spotId', (req, res) => {
  const removed = removeFavorite(req.user.id, req.params.spotId);

  // Removing something that is not saved is also success: the end state the
  // user asked for is "not saved".
  return sendObject(res, {
    spotId: req.params.spotId,
    favorite: false,
    removed,
    count: countFavorites(req.user.id),
    ids: listFavoriteIds(req.user.id),
  });
});
