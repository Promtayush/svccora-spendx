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
  const dateStr = expense.date ? new Date(expense.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) : 'N/A';
  const ownerName = expense.user?.name || expense.user?.email || 'Employee';
  const ownerEmail = expense.user?.email || '';
  const department = expense.user?.department || 'Operations';
  const costCenter = expense.costCenterCode || expense.user?.costCenter || 'CC-101';
  const approvalStatus = (expense.approvalStatus || 'APPROVED').replace(/_/g, ' ');
  const paymentMethod = (expense.paymentMethod || 'REIMBURSEMENT').replace(/_/g, ' ');

  const historyEvents = (expense.workflowHistory || []).map((h) => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="timeline-action">${escapeXml(h.action)}</span>
          <span class="timeline-date">${new Date(h.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="timeline-actor">By: <strong>${escapeXml(h.actorName)}</strong> (${escapeXml(h.actorRole)})</div>
        ${h.comment ? `<div class="timeline-comment">"${escapeXml(h.comment)}"</div>` : ''}
      </div>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expense Voucher #EXP-${expense.id} | SVCORA SpendX</title>
  <style>
    :root {
      --bg: #09090b;
      --card-bg: #111114;
      --card-border: #27272a;
      --border-subtle: #1f1f23;
      --text-main: #f4f4f5;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --accent: #10b981;
      --accent-bg: rgba(16, 185, 129, 0.08);
      --accent-border: rgba(16, 185, 129, 0.25);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      padding: 32px 16px;
      line-height: 1.5;
      display: flex;
      justify-content: center;
      -webkit-font-smoothing: antialiased;
    }
    .voucher-wrapper {
      max-width: 820px;
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    .top-toolbar {
      background: #141418;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--card-border);
    }
    .toolbar-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      background: #1f1f23;
      color: var(--text-main);
      border: 1px solid var(--card-border);
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease, border-color 0.15s ease;
      text-decoration: none;
    }
    .btn:hover { background: #27272a; }
    .btn-primary {
      background: #27272a;
      color: #fff;
      border-color: #3f3f46;
    }
    .btn-primary:hover { background: #3f3f46; }
    
    .voucher-body { padding: 32px 28px; }
    
    .brand-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 24px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand-logo-group h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-pill {
      font-size: 11px;
      font-weight: 500;
      background: #1f1f23;
      color: var(--text-secondary);
      border: 1px solid var(--card-border);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .brand-sub {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 3px;
    }
    .voucher-id-block {
      text-align: right;
    }
    .voucher-num {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--accent-bg);
      color: var(--accent);
      border: 1px solid var(--accent-border);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .meta-box {
      background: #16161a;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 16px;
    }
    .meta-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .meta-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-main);
      word-break: break-word;
    }
    .meta-sub {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
      word-break: break-word;
    }
    .amount-highlight {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 24px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--text-main);
      letter-spacing: -0.5px;
    }

    .table-container {
      margin-bottom: 24px;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background: #16161a;
      padding: 10px 16px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--card-border);
    }
    td {
      padding: 14px 16px;
      font-size: 13px;
      border-top: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      vertical-align: top;
    }
    .col-amount {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 600;
      font-size: 14px;
      font-variant-numeric: tabular-nums;
      color: var(--text-main);
      white-space: nowrap;
    }

    .compliance-box {
      background: #141418;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .compliance-icon {
      color: var(--accent);
      margin-top: 2px;
      flex-shrink: 0;
    }
    .compliance-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-main);
    }
    .compliance-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
      line-height: 1.45;
    }

    .file-record {
      background: #141418;
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 24px;
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .file-ref {
      font-family: ui-monospace, monospace;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .audit-section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }
    .timeline {
      border-left: 1px solid var(--card-border);
      margin-left: 8px;
      padding-left: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .timeline-item {
      position: relative;
    }
    .timeline-dot {
      position: absolute;
      left: -20px;
      top: 5px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--text-muted);
      box-shadow: 0 0 0 2px var(--card-bg);
    }
    .timeline-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 500;
    }
    .timeline-action { color: var(--text-main); font-weight: 600; }
    .timeline-date { color: var(--text-muted); font-size: 11px; font-family: ui-monospace, monospace; }
    .timeline-actor { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
    .timeline-comment { font-size: 12px; color: var(--text-muted); font-style: italic; margin-top: 2px; }

    .voucher-footer {
      border-top: 1px solid var(--card-border);
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--text-muted);
      flex-wrap: wrap;
      gap: 8px;
    }

    @media print {
      body { background: #fff !important; color: #000 !important; padding: 0 !important; }
      .top-toolbar { display: none !important; }
      .voucher-wrapper { border: none !important; box-shadow: none !important; max-width: 100% !important; background: #fff !important; }
      .brand-header { border-bottom: 1px solid #000 !important; }
      .brand-logo-group h1 { color: #000 !important; }
      .brand-pill { background: #eee !important; color: #000 !important; border-color: #ccc !important; }
      .brand-sub, .meta-sub, .compliance-desc, .timeline-comment { color: #444 !important; }
      .status-badge { border: 1px solid #000 !important; color: #000 !important; background: #eee !important; }
      .meta-box { border: 1px solid #ccc !important; background: #fafafa !important; }
      .meta-label, .section-title { color: #333 !important; }
      .meta-value { color: #000 !important; }
      .amount-highlight { color: #000 !important; font-weight: 700 !important; }
      table { border: 1px solid #ccc !important; }
      th { background: #f0f0f0 !important; color: #000 !important; border-bottom: 1px solid #ccc !important; }
      td { border-top: 1px solid #ccc !important; color: #000 !important; }
      .col-amount { color: #000 !important; }
      .compliance-box { background: #fafafa !important; border: 1px solid #ccc !important; }
      .compliance-title { color: #000 !important; }
      .file-record { background: #fafafa !important; border: 1px solid #ccc !important; color: #333 !important; }
      .file-ref { color: #000 !important; }
      .timeline { border-left-color: #ccc !important; }
      .timeline-dot { background: #000 !important; box-shadow: 0 0 0 2px #fff !important; }
      .timeline-action { color: #000 !important; font-weight: bold !important; }
      .voucher-footer { border-top: 1px solid #ccc !important; color: #555 !important; }
    }
  </style>
</head>
<body>
  <div class="voucher-wrapper">
    <div class="top-toolbar">
      <div class="toolbar-title">
        <span>SVCORA SpendX Audit &amp; Tax Archive</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-primary" onclick="window.print()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
          Print / Save as PDF
        </button>
        <button class="btn" onclick="window.close()">Close</button>
      </div>
    </div>

    <div class="voucher-body">
      <div class="brand-header">
        <div class="brand-logo-group">
          <h1>
            <span>SVCORA SpendX</span>
            <span class="brand-pill">Verified</span>
          </h1>
          <div class="brand-sub">Enterprise Expense Reimbursement Voucher &amp; Tax Record</div>
          <div class="brand-sub"><strong>SVC Infosystems</strong> &bull; Finance &amp; Accounting Operations</div>
        </div>
        <div class="voucher-id-block">
          <div class="voucher-num">#EXP-${String(expense.id).padStart(4, '0')}</div>
          <div class="status-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ${escapeXml(approvalStatus)}
          </div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-box">
          <div class="meta-label">Claimant details</div>
          <div class="meta-value">${escapeXml(ownerName)}</div>
          <div class="meta-sub">${escapeXml(ownerEmail)}</div>
          <div class="meta-sub">${escapeXml(department)}</div>
        </div>

        <div class="meta-box">
          <div class="meta-label">Expense &amp; cost object</div>
          <div class="meta-value">Incurred: ${escapeXml(dateStr)}</div>
          <div class="meta-sub">Cost Center: <strong>${escapeXml(costCenter)}</strong></div>
          <div class="meta-sub">Mechanism: ${escapeXml(paymentMethod)}</div>
        </div>

        <div class="meta-box" style="border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.03);">
          <div class="meta-label">Total approved &amp; cleared</div>
          <div class="amount-highlight">₹${amountStr}</div>
          <div class="meta-sub" style="color: var(--accent);">Cleared for settlement</div>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 32%;">Category &amp; classification</th>
              <th style="width: 48%;">Business description &amp; purpose</th>
              <th style="width: 20%; text-align: right;">Cleared amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style="font-weight: 600; color: var(--text-main);">${escapeXml(expense.category)}</div>
                ${expense.categoryCode ? `<div style="font-size: 11px; color: var(--text-muted); font-family: ui-monospace, monospace; margin-top: 2px;">Code: ${escapeXml(expense.categoryCode)}</div>` : ''}
              </td>
              <td>
                <div style="color: var(--text-secondary);">${escapeXml(expense.description)}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Cost Center Allocation: ${escapeXml(costCenter)}</div>
              </td>
              <td class="col-amount">₹${amountStr}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="compliance-box">
        <svg class="compliance-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
        <div>
          <div class="compliance-title">Audit Clearance &amp; Internal Controls Verification</div>
          <div class="compliance-desc">
            This expense voucher has completed the multi-tier approval hierarchy (operational 1-up manager review, signing authority check, and accounts payable audit). Cleared for corporate disbursal in accordance with SVC Infosystems Financial Policies.
          </div>
        </div>
      </div>

      <div class="file-record">
        <div>
          <span>Archived File Reference: </span>
          <span class="file-ref">${escapeXml(filename)}</span>
        </div>
        <div style="font-family: ui-monospace, monospace; font-size: 11px; color: var(--text-muted);">
          Audit Proof ID: SPX-${expense.id}-${Date.now().toString(36).toUpperCase()}
        </div>
      </div>

      ${historyEvents ? `
      <div class="audit-section">
        <div class="section-title">Chronological audit trail</div>
        <div class="timeline">
          ${historyEvents}
        </div>
      </div>
      ` : ''}

      <div class="voucher-footer">
        <div>Generated by SVCORA SpendX Enterprise Platform &bull; ${new Date().toLocaleString('en-IN')}</div>
        <div>Official Tax Document &bull; Strictly Confidential</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
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
