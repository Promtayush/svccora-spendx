import express from 'express';
import {
  createExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  approveAndForwardExpense,
  payExpense,
  getWorkflowHistory,
  uploadReceiptAttachment,
  getExpenseReceipt,
} from '../controllers/expenseController.js';
import { authenticateUser } from '../middlewares/authenticateUser.js';
import { requireRole } from '../middlewares/requireRole.js';
import { uploadReceipt } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.use(authenticateUser);

router.post('/upload', uploadReceipt.single('receipt'), uploadReceiptAttachment);
router.post('/', uploadReceipt.single('receipt'), createExpense);
router.get('/', getExpenses);
router.post('/:id/submit', submitExpense);
router.patch('/:id/approve', approveExpense);
router.patch('/:id/reject', rejectExpense);
router.patch('/:id/send-back', rejectExpense);
router.patch('/:id/approve-and-forward', approveAndForwardExpense);
router.patch('/:id/pay', requireRole('FINANCE', 'ADMIN'), payExpense);
router.get('/:id/history', getWorkflowHistory);
router.get('/:id/receipt', getExpenseReceipt);
router.put('/:id', uploadReceipt.single('receipt'), updateExpense);
router.delete('/:id', deleteExpense);

export default router;
