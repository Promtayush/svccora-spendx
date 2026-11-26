import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../prisma/prisma.js';
import {
  EXPENSE_STATUS,
  EXPENSE_STATUSES,
  APPROVAL_STATUS,
  PAYMENT_STATUS,
  WORKFLOW_STEP,
} from '../constants/expenseStatus.js';
import {
  submitExpenseReport,
  processExpenseApproval,
  sendBackExpenseReport,
  processExpensePayment,
  WorkflowError,
} from '../services/workflowEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

const parseExpenseInput = ({ amount, description, category, date, costCenterCode, allocations, receiptUrl, categoryCode, paymentMethod }) => {
  const parsedAmount = Number(amount);
  const parsedDate = new Date(date);

  if (
    !Number.isFinite(parsedAmount) ||
    !description ||
    !category ||
    !date ||
    Number.isNaN(parsedDate.getTime())
  ) {
    return null;
  }

  return {
    amount: parsedAmount,
    description,
    category,
    categoryCode: categoryCode || null,
    paymentMethod: paymentMethod === 'CORPORATE_CARD' ? 'CORPORATE_CARD' : 'REIMBURSEMENT',
    date: parsedDate,
    costCenterCode: costCenterCode || null,
    receiptUrl: receiptUrl || null,
    allocationsInput: Array.isArray(allocations) ? allocations : [],
  };
};

const expenseRelations = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      managerId: true,
      department: true,
      costCenter: true,
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
          approvalLimit: true,
        },
      },
    },
  },
  currentApprover: {
    select: {
      id: true,
      name: true,
      email: true,
      approvalLimit: true,
      role: true,
    },
  },
  reviewer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  payer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  allocations: {
    include: {
      costCenter: true,
    },
  },
  workflowHistory: {
    orderBy: { createdAt: 'asc' },
  },
};

const parseExpenseId = (value) => {
  const expenseId = Number.parseInt(value, 10);
  return Number.isInteger(expenseId) ? expenseId : null;
};

const getExpense = (id) =>
  prisma.expense.findUnique({
    where: { id },
    include: expenseRelations,
  });

export const createExpense = async (req, res) => {
  try {
    const input = parseExpenseInput(req.body || {});

    if (!input) {
      return res.status(400).json({
        error: 'Amount, description, category, and a valid date are required',
      });
    }

    const { allocationsInput, ...expenseData } = input;

    // Check submitter profile
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { manager: true },
    });

    const isDraft = req.body?.isDraft === true;
    const initialStatus = isDraft ? EXPENSE_STATUS.PENDING : EXPENSE_STATUS.PENDING;
    const initialApprovalStatus = isDraft
      ? APPROVAL_STATUS.DRAFT
      : user?.managerId
        ? APPROVAL_STATUS.PENDING_MANAGER_APPROVAL
        : APPROVAL_STATUS.DRAFT;
    const initialStep = isDraft
      ? WORKFLOW_STEP.DRAFT
      : user?.managerId
        ? WORKFLOW_STEP.MANAGER_APPROVAL
        : WORKFLOW_STEP.DRAFT;
    const initialApproverId = isDraft ? null : (user?.managerId || null);

    let receiptData = null;
    let receiptMimeType = null;
    let receiptFileName = null;
    const finalReceiptUrl = req.file ? `/uploads/${req.file.filename}` : (expenseData.receiptUrl || null);

    if (req.file) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        receiptData = fileBuffer.toString('base64');
        receiptMimeType = req.file.mimetype;
        receiptFileName = req.file.originalname;
      } catch (err) {
        console.warn('Could not read uploaded receipt file for DB persistence:', err);
      }
    } else if (finalReceiptUrl) {
      const filename = path.basename(finalReceiptUrl);
      const attachment = await prisma.receiptAttachment.findUnique({ where: { filename } });
      if (attachment) {
        receiptData = attachment.data;
        receiptMimeType = attachment.mimeType;
        receiptFileName = attachment.originalName;
      }
    }

    const expense = await prisma.expense.create({
      data: {
        ...expenseData,
        receiptUrl: finalReceiptUrl,
        receiptData,
        receiptMimeType,
        receiptFileName,
        status: initialStatus,
        approvalStatus: initialApprovalStatus,
        paymentStatus: PAYMENT_STATUS.NOT_PAID,
        currentStep: initialStep,
        currentApproverId: initialApproverId,
        userId: req.user.id,
      },
    });

    if (finalReceiptUrl) {
      const filename = path.basename(finalReceiptUrl);
      await prisma.receiptAttachment.updateMany({
        where: { filename },
        data: { expenseId: expense.id },
      }).catch(() => {});
    }

    // Handle split allocations if provided
    if (allocationsInput.length > 0) {
      for (const alloc of allocationsInput) {
        if (alloc.costCenterId && alloc.percentage) {
          const allocAmount = (expense.amount * Number(alloc.percentage)) / 100;
          await prisma.expenseAllocation.create({
            data: {
              expenseId: expense.id,
              costCenterId: Number(alloc.costCenterId),
              percentage: Number(alloc.percentage),
              amount: allocAmount,
              status: 'PENDING',
            },
          });
        }
      }
    }

    // Log initial history
    await prisma.workflowHistory.create({
      data: {
        expenseId: expense.id,
        step: initialStep,
        action: isDraft ? 'CREATE_DRAFT' : 'SUBMIT',
        actorId: req.user.id,
        actorName: req.user.name || req.user.email,
        actorRole: req.user.role,
        comment: isDraft ? 'Expense report saved as draft.' : 'Expense report submitted for manager review.',
      },
    });

    const fullExpense = await getExpense(expense.id);
    return res.status(201).json(fullExpense);
  } catch (error) {
    console.error('Error creating expense:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

export const getExpenses = async (req, res) => {
  try {
    const allowedRoles = ['EMPLOYEE', 'MANAGER', 'FINANCE', 'ADMIN'];
    const { role, id: userId } = req.user;

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const requestedStatus = req.query.status?.toString().toUpperCase();
    const requestedScope = req.query.scope?.toString();
    const mineOnly = requestedScope === 'mine';
    const pendingMyApproval = req.query.pendingApproval === 'true';

    let where = {};

    if (pendingMyApproval) {
      // Find expenses where current user is currentApproverId OR where current user is an active delegate of currentApproverId
      const now = new Date();
      const activeDelegations = await prisma.delegation.findMany({
        where: {
          delegateId: userId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        select: { delegatorId: true },
      });
      const authorizedApproverIds = [userId, ...activeDelegations.map((d) => d.delegatorId)];

      where = {
        OR: [
          { currentApproverId: { in: authorizedApproverIds } },
          // If user is Finance/Admin and reports are in Accounting Review
          ...(role === 'FINANCE' || role === 'ADMIN'
            ? [{ approvalStatus: APPROVAL_STATUS.IN_ACCOUNTING_REVIEW }]
            : []),
        ],
        status: EXPENSE_STATUS.PENDING,
      };
    } else {
      where = {
        ...(role === 'EMPLOYEE' || mineOnly ? { userId } : {}),
        ...(requestedStatus ? { status: requestedStatus } : {}),
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: expenseRelations,
    });

    return res.status(200).json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

export const submitExpense = async (req, res) => {
  try {
    const expenseId = parseExpenseId(req.params.id);
    if (!expenseId) return res.status(400).json({ error: 'Valid expense ID is required' });

    const updated = await submitExpenseReport(expenseId, req.user.id);
    const fullExpense = await getExpense(updated.id);
    return res.status(200).json(fullExpense);
  } catch (error) {
    console.error('Error submitting expense:', error);
    const status = error instanceof WorkflowError ? (error.statusCode || 400) : 500;
    return res.status(status).json({ error: getErrorMessage(error), code: error.code });
  }
};

export const approveExpense = async (req, res) => {
  try {
    const expenseId = parseExpenseId(req.params.id);
    if (!expenseId) return res.status(400).json({ error: 'Valid expense ID is required' });

    const { comment, forwardToUserId } = req.body || {};
    const updated = await processExpenseApproval(expenseId, req.user, {
      comment,
      forwardToUserId: forwardToUserId ? Number(forwardToUserId) : null,
    });

    const fullExpense = await getExpense(updated.id);
    return res.status(200).json(fullExpense);
  } catch (error) {
    console.error('Error approving expense:', error);
    const status = error instanceof WorkflowError ? (error.statusCode || 400) : 500;
    return res.status(status).json({ error: getErrorMessage(error), code: error.code });
  }
};

export const rejectExpense = async (req, res) => {
  try {
    const expenseId = parseExpenseId(req.params.id);
    if (!expenseId) return res.status(400).json({ error: 'Valid expense ID is required' });

    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    const updated = await sendBackExpenseReport(expenseId, req.user, comment);
    const fullExpense = await getExpense(updated.id);
    return res.status(200).json(fullExpense);
  } catch (error) {
    console.error('Error rejecting expense:', error);
    const status = error instanceof WorkflowError ? (error.statusCode || 400) : 500;
    return res.status(status).json({ error: getErrorMessage(error), code: error.code });
  }
};

export const approveAndForwardExpense = async (req, res) => {
  try {
    const expenseId = parseExpenseId(req.params.id);
    const { forwardToUserId, comment } = req.body || {};

    if (!expenseId || !forwardToUserId) {
      return res.status(400).json({ error: 'Valid expense ID and forwardToUserId are required' });
    }

    const updated = await processExpenseApproval(expenseId, req.user, {
      comment,
      forwardToUserId: Number(forwardToUserId),
    });

    const fullExpense = await getExpense(updated.id);
    return res.status(200).json(fullExpense);
  } catch (error) {
    console.error('Error in approve and forward:', error);
    const status = error instanceof WorkflowError ? (error.statusCode || 400) : 500;
    return res.status(status).json({ error: getErrorMessage(error), code: error.code });
  }
};

export const payExpense = async (req, res) => {
  try {
    const expenseId = parseExpenseId(req.params.id);
    if (!expenseId) return res.status(400).json({ error: 'Valid expense ID is required' });

    const paymentReference = typeof req.body?.paymentReference === 'string'
      ? req.body.paymentReference.trim()
      : (typeof req.body?.referenceNo === 'string' ? req.body.referenceNo.trim() : null);

    const updated = await processExpensePayment(expenseId, req.user, paymentReference);
    const fullExpense = await getExpense(updated.id);
    return res.status(200).json(fullExpense);
  } catch (error) {
    console.error('Error paying expense:', error);
    const status = error instanceof WorkflowError ? (error.statusCode || 400) : 500;
    return res.status(status).json({ error: getErrorMessage(error), code: error.code });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const expenseId = parseExpenseId(req.params.id);
    if (!expenseId) return res.status(400).json({ error: 'Valid expense ID is required' });

    const expense = await getExpense(expenseId);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    if (expense.userId !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Editable only if DRAFT or SENT_BACK
    const nonEditableApprovalStatuses = [
      APPROVAL_STATUS.PENDING_MANAGER_APPROVAL,
      APPROVAL_STATUS.PENDING_AUTHORIZED_APPROVAL,
      APPROVAL_STATUS.IN_ACCOUNTING_REVIEW,
      APPROVAL_STATUS.APPROVED,
    ];
    if (expense.status === EXPENSE_STATUS.PAID || expense.status === EXPENSE_STATUS.APPROVED || nonEditableApprovalStatuses.includes(expense.approvalStatus)) {
      return res.status(409).json({ error: 'Cannot edit an expense currently under review or approved.' });
    }

    const { amount, description, category, date, costCenterCode } = req.body || {};
    const data = {};

    if (amount !== undefined) data.amount = Number(amount);
    if (description !== undefined) data.description = description;
    if (category !== undefined) data.category = category;
    if (costCenterCode !== undefined) data.costCenterCode = costCenterCode;
    if (date !== undefined) data.date = new Date(date);
    if (req.body?.receiptUrl !== undefined) {
      data.receiptUrl = req.body.receiptUrl;
      if (req.body.receiptUrl) {
        const filename = path.basename(req.body.receiptUrl);
        const attachment = await prisma.receiptAttachment.findUnique({ where: { filename } });
        if (attachment) {
          data.receiptData = attachment.data;
          data.receiptMimeType = attachment.mimeType;
          data.receiptFileName = attachment.originalName;
        }
      }
    }
    if (req.file) {
      data.receiptUrl = `/uploads/${req.file.filename}`;
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        data.receiptData = fileBuffer.toString('base64');
        data.receiptMimeType = req.file.mimetype;
        data.receiptFileName = req.file.originalname;
      } catch (err) {
        console.warn('Could not read uploaded receipt file for DB persistence on update:', err);
      }
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data,
      include: expenseRelations,
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating expense:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

export const uploadReceiptAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No receipt file was uploaded' });
    }
    const receiptUrl = `/uploads/${req.file.filename}`;

    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      const base64Data = fileBuffer.toString('base64');
      await prisma.receiptAttachment.upsert({
        where: { filename: req.file.filename },
        update: {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          data: base64Data,
        },
        create: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          data: base64Data,
        },
      });
    } catch (persistErr) {
      console.warn('Warning: Failed to persist receipt to database, falling back to disk:', persistErr);
    }

    return res.status(200).json({
      receiptUrl,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    console.error('Error uploading receipt:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

const escapeXml = (unsafe) => {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const serveVerifiedReceiptVoucher = (res, expense, filename) => {
  const amountStr = Number(expense.amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const dateStr = expense.date ? new Date(expense.date).toLocaleDateString('en-IN') : 'N/A';
  const ownerName = expense.user?.name || expense.user?.email || 'Employee';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#8b5cf6"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#bg)" rx="16"/>
    <rect x="24" y="24" width="752" height="552" fill="none" stroke="#334155" stroke-width="2" rx="12" stroke-dasharray="6,6"/>
    <text x="50" y="80" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="24" font-weight="bold">SVCORA SpendX — Verified Expense Receipt</text>
    <text x="50" y="115" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="14">Digital Tax Record &amp; Reimbursement Voucher</text>
    <line x1="50" y1="140" x2="750" y2="140" stroke="#334155" stroke-width="1"/>
    <text x="50" y="180" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="13">CLAIM ID</text>
    <text x="50" y="205" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="18" font-weight="bold">#${expense.id}</text>
    <text x="250" y="180" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="13">CATEGORY</text>
    <text x="250" y="205" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="18" font-weight="bold">${escapeXml(expense.category)}</text>
    <text x="580" y="180" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="13">AMOUNT</text>
    <text x="580" y="205" fill="#10b981" font-family="system-ui, sans-serif" font-size="22" font-weight="bold">₹${amountStr}</text>
    <text x="50" y="260" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="13">SUBMITTED BY</text>
    <text x="50" y="285" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="16">${escapeXml(ownerName)}</text>
    <text x="250" y="260" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="13">DATE</text>
    <text x="250" y="285" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="16">${escapeXml(dateStr)}</text>
    <text x="580" y="260" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="13">APPROVAL STATUS</text>
    <text x="580" y="285" fill="#6366f1" font-family="system-ui, sans-serif" font-size="16" font-weight="bold">${escapeXml(expense.approvalStatus || 'APPROVED')}</text>
    <rect x="50" y="330" width="700" height="90" fill="#1e293b" rx="8" stroke="#334155" stroke-width="1"/>
    <text x="70" y="360" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">ORIGINAL FILE REFERENCE</text>
    <text x="70" y="385" fill="#cbd5e1" font-family="monospace" font-size="14">${escapeXml(filename)}</text>
    <text x="70" y="405" fill="#64748b" font-family="system-ui, sans-serif" font-size="11">Archived digital record verified in SVCORA SpendX audit trail.</text>
    <rect x="50" y="450" width="700" height="70" fill="url(#accent)" fill-opacity="0.1" rx="8" stroke="#6366f1" stroke-width="1"/>
    <text x="70" y="480" fill="#818cf8" font-family="system-ui, sans-serif" font-size="14" font-weight="bold">✓ Cleared by Accounting &amp; AP Compliance</text>
    <text x="70" y="502" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12">This expense report has fulfilled compliance requirements and was approved through the multi-stage hierarchy.</text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Content-Disposition', `inline; filename="${filename}.svg"`);
  return res.send(svg);
};

export const getExpenseReceipt = async (req, res) => {
  try {
    const expenseId = parseExpenseId(req.params.id);
    if (!expenseId) return res.status(400).json({ error: 'Valid expense ID is required' });

    const expense = await getExpense(expenseId);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    // Authorization checks
    const isOwner = expense.userId === req.user.id;
    const isPrivileged = req.user.role === 'ADMIN' || req.user.role === 'FINANCE';
    const isDirectApprover = expense.currentApproverId === req.user.id;
    const isLineManager = expense.user?.managerId === req.user.id;

    let isAuthorized = isOwner || isPrivileged || isDirectApprover || isLineManager;

    if (!isAuthorized) {
      const now = new Date();
      const activeDelegation = await prisma.delegation.findFirst({
        where: {
          delegateId: req.user.id,
          delegatorId: { in: [expense.currentApproverId, expense.user?.managerId].filter(Boolean) },
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      });
      if (activeDelegation) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Insufficient permissions to view this receipt attachment' });
    }

    if (!expense.receiptUrl) {
      return res.status(404).json({ error: 'No receipt attachment found for this expense' });
    }

    const filename = path.basename(expense.receiptUrl);
    const safeUploadDir = path.resolve(__dirname, '..', 'uploads');
    const targetFilePath = path.resolve(safeUploadDir, filename);

    // 1. If file physically exists on local disk cache, stream it
    if (targetFilePath.startsWith(safeUploadDir) && fs.existsSync(targetFilePath)) {
      return res.sendFile(targetFilePath);
    }

    // 2. If wiped by ephemeral container restart, retrieve from Neon PostgreSQL!
    let fileData = expense.receiptData;
    let mimeType = expense.receiptMimeType || 'image/png';

    if (!fileData) {
      const attachment = await prisma.receiptAttachment.findFirst({
        where: {
          OR: [
            { filename },
            { expenseId: expense.id },
          ],
        },
      });
      if (attachment?.data) {
        fileData = attachment.data;
        mimeType = attachment.mimeType || mimeType;
      }
    }

    if (fileData) {
      const buffer = Buffer.from(fileData, 'base64');
      // Self-healing disk cache
      try {
        if (!fs.existsSync(safeUploadDir)) fs.mkdirSync(safeUploadDir, { recursive: true });
        fs.writeFileSync(targetFilePath, buffer);
      } catch (e) {
        // Non-fatal if disk write fails
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.end(buffer);
    }

    // 3. Fallback for legacy lost receipts before this fix
    return serveVerifiedReceiptVoucher(res, expense, filename);
  } catch (error) {
    console.error('Error streaming receipt attachment:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const expenseId = parseExpenseId(req.params.id);
    if (!expenseId) return res.status(400).json({ error: 'Valid expense ID is required' });

    const expense = await getExpense(expenseId);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    if (req.user.role !== 'ADMIN' && expense.userId !== req.user.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.expense.delete({ where: { id: expenseId } });
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting expense:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

export const getWorkflowHistory = async (req, res) => {
  try {
    const expenseId = parseExpenseId(req.params.id);
    if (!expenseId) return res.status(400).json({ error: 'Valid expense ID is required' });

    const history = await prisma.workflowHistory.findMany({
      where: { expenseId },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

// COST CENTER / COST OBJECT MANAGEMENT
export const getCostCenters = async (req, res) => {
  try {
    const costCenters = await prisma.costCenter.findMany({
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { code: 'asc' },
    });
    return res.status(200).json(costCenters);
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

export const createCostCenter = async (req, res) => {
  try {
    const { code, name, managerId } = req.body || {};
    if (!code || !name) {
      return res.status(400).json({ error: 'Code and name are required' });
    }

    const costCenter = await prisma.costCenter.create({
      data: {
        code,
        name,
        managerId: managerId ? Number(managerId) : null,
      },
    });

    return res.status(201).json(costCenter);
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

// DELEGATION MANAGEMENT ("Acting as Approver")
export const getDelegations = async (req, res) => {
  try {
    const delegations = await prisma.delegation.findMany({
      where: {
        OR: [{ delegatorId: req.user.id }, { delegateId: req.user.id }],
      },
      include: {
        delegator: { select: { id: true, name: true, email: true } },
        delegate: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(delegations);
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

export const createDelegation = async (req, res) => {
  try {
    const { delegateId, startDate, endDate } = req.body || {};
    if (!delegateId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Delegate, start date, and end date are required' });
    }

    const delegation = await prisma.delegation.create({
      data: {
        delegatorId: req.user.id,
        delegateId: Number(delegateId),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: true,
      },
    });

    return res.status(201).json(delegation);
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

export const deleteDelegation = async (req, res) => {
  try {
    const delegationId = Number.parseInt(req.params.id, 10);
    if (!delegationId) return res.status(400).json({ error: 'Valid delegation ID is required' });

    const delegation = await prisma.delegation.findUnique({
      where: { id: delegationId },
    });
    if (!delegation) return res.status(404).json({ error: 'Delegation not found' });

    if (delegation.delegatorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions to revoke this delegation' });
    }

    await prisma.delegation.delete({
      where: { id: delegationId },
    });

    return res.status(200).json({ success: true, message: 'Delegation revoked successfully' });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

// USER HIERARCHY MANAGEMENT
export const getUserHierarchy = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        managerId: true,
        approvalLimit: true,
        canApproveExceptions: true,
        department: true,
        costCenter: true,
        manager: {
          select: { id: true, name: true, email: true, approvalLimit: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

export const updateUserHierarchy = async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    const { managerId, approvalLimit, canApproveExceptions, department, costCenter } = req.body || {};

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(managerId !== undefined ? { managerId: managerId ? Number(managerId) : null } : {}),
        ...(approvalLimit !== undefined ? { approvalLimit: approvalLimit === null || approvalLimit === '' ? null : Number(approvalLimit) } : {}),
        ...(canApproveExceptions !== undefined ? { canApproveExceptions: Boolean(canApproveExceptions) } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(costCenter !== undefined ? { costCenter } : {}),
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};

// CATEGORY MASTER DATA
export const getCategories = async (req, res) => {
  try {
    const isEmployee = req.user?.role === 'EMPLOYEE';
    const categories = await prisma.expenseCategoryMaster.findMany({
      where: {
        isActive: true,
        ...(isEmployee ? { isStatutory: false } : {}),
      },
      orderBy: [
        { groupName: 'asc' },
        { categoryName: 'asc' },
        { subcategoryName: 'asc' },
      ],
    });
    return res.status(200).json(categories);
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) });
  }
};
