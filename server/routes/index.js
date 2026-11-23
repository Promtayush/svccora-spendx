import express from 'express';
import { authenticateUser } from '../middlewares/authenticateUser.js';
import { requireRole } from '../middlewares/requireRole.js';
import { signup, login, create, update, updateRole, forgotPassword, resetPassword } from '../controllers/user.controller.js/controller.js';
import {
  getCostCenters,
  createCostCenter,
  getDelegations,
  createDelegation,
  deleteDelegation,
  getUserHierarchy,
  updateUserHierarchy,
  getCategories,
} from '../controllers/expenseController.js';
import { rateLimit } from '../middlewares/rateLimiter.js';

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const router = express.Router();

const authorizeUserUpdate = (req, res, next) => {
    const targetUserId = Number.parseInt(req.params.id, 10);
    const isAdmin = req.user.role === 'ADMIN';
    const isSelf = req.user.id === targetUserId;

    if (req.body?.role !== undefined) {
        return requireRole('ADMIN')(req, res, next);
    }

    if (!isAdmin && !isSelf) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
};

router.post('/login', authLimiter, login);
router.post('/signup', authLimiter, signup);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/api/auth/forgot-password', authLimiter, forgotPassword);
router.post('/api/auth/reset-password', authLimiter, resetPassword);

// sign-up
router.post('/user/signup', authLimiter, signup);

// login
router.post('/user/login', authLimiter, login);

// create user (Admin only)
router.post('/user', authenticateUser, requireRole('ADMIN'), create);

// update user
router.put('/user/:id', authenticateUser, authorizeUserUpdate, update);
router.patch('/api/users/:id/role', authenticateUser, requireRole('ADMIN'), updateRole);

// SVCORA_SpendX Hierarchy, Cost Centers, and Delegation Endpoints
router.get('/api/categories', authenticateUser, getCategories);
router.get('/api/cost-centers', authenticateUser, getCostCenters);
router.post('/api/cost-centers', authenticateUser, requireRole('ADMIN'), createCostCenter);

router.get('/api/delegations', authenticateUser, getDelegations);
router.post('/api/delegations', authenticateUser, createDelegation);
router.delete('/api/delegations/:id', authenticateUser, deleteDelegation);

router.get('/api/users/hierarchy', authenticateUser, getUserHierarchy);
router.patch('/api/users/:id/hierarchy', authenticateUser, requireRole('ADMIN'), updateUserHierarchy);

export default router;
