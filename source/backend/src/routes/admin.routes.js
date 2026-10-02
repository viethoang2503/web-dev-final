/**
 * API QUẢN TRỊ (gắn vào /api/admin, chỉ admin):
 * GET /users, PATCH /users/:id {role?, plan?}, DELETE /users/:id;
 * GET /spots, POST /spots, PUT /spots/:id, DELETE /spots/:id.
 */
import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { ApiError, sendList, sendObject } from '../utils/http-response.js';
import { listSpots } from '../services/spots.service.js';
import { createSpot, deleteSpot, deleteUser, listUsers, setUserPlan, setUserRole, updateSpot } from '../services/admin.service.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

function userId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw ApiError.validation('User id must be a number.');
  return id;
}

adminRouter.get('/users', (req, res) => sendList(res, listUsers()));

adminRouter.patch('/users/:id', (req, res) => {
  const id = userId(req);
  const { role, plan } = req.body ?? {};
  if (role === undefined && plan === undefined) throw ApiError.validation('Send role and/or plan.');
  if (plan !== undefined) setUserPlan(id, plan);
  if (role !== undefined) setUserRole(req.user.id, id, role);
  sendObject(res, null);
});

adminRouter.delete('/users/:id', (req, res) => {
  deleteUser(req.user.id, userId(req));
  sendObject(res, null);
});

adminRouter.get('/spots', (req, res) => sendList(res, listSpots()));

adminRouter.post('/spots', (req, res) => sendObject(res, createSpot(req.body), 201));

adminRouter.put('/spots/:id', (req, res) => sendObject(res, updateSpot(req.params.id, req.body)));

adminRouter.delete('/spots/:id', (req, res) => {
  deleteSpot(req.params.id);
  sendObject(res, null);
});
