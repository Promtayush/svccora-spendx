import prisma from '../prisma/prisma.js';
import {
  EXPENSE_STATUS,
  APPROVAL_STATUS,
  PAYMENT_STATUS,
  WORKFLOW_STEP,
  WORKFLOW_ACTION,
} from '../constants/expenseStatus.js';
import {
  sendClaimSubmittedEmail,
  sendClaimApprovedEmail,
  sendClaimSentBackEmail,
  sendClaimPaidEmail,
} from './emailService.js';

export class WorkflowError extends Error {
  constructor(message, code = 'WORKFLOW_ERROR', statusCode = 400) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Checks if actor is authorized to act on behalf of the expected approver (Direct or Active Delegate).
 */
export async function resolveActorAuthority(actorId, expectedApproverId) {
  if (!expectedApproverId) {
    return { isAuthorized: false, isDelegate: false, delegatorId: null };
  }
  if (actorId === expectedApproverId) {
    return { isAuthorized: true, isDelegate: false, delegatorId: null };
  }

  // Check active delegations
  const now = new Date();
  const delegation = await prisma.delegation.findFirst({
    where: {
      delegatorId: expectedApproverId,
      delegateId: actorId,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: {
      delegator: { select: { id: true, name: true, email: true, approvalLimit: true } },
    },
  });

  if (delegation) {
    return {
      isAuthorized: true,
      isDelegate: true,
      delegatorId: delegation.delegatorId,
      delegatorName: delegation.delegator.name || delegation.delegator.email,
      delegatorLimit: delegation.delegator.approvalLimit,
    };
  }

  return { isAuthorized: false };
}

/**
 * Find an approver up the management chain with sufficient limit.
 */
export async function findNextAuthorizedApprover(startManagerId, amount) {
  let currentId = startManagerId;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const mgr = await prisma.user.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, email: true, approvalLimit: true, managerId: true },
    });

    if (!mgr) break;

    // NULL approval limit represents Unlimited Signing Authority
    if (mgr.approvalLimit === null || mgr.approvalLimit >= amount) {
      return mgr;
    }

    currentId = mgr.managerId;
  }

  return null; // Top of hierarchy exceeded
}

/**
 * Submits an expense report into the SVCORA_SpendX Approval Workflow.
 */
export async function submitExpenseReport(expenseId, userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { manager: true },
  });

  if (!user) throw new WorkflowError('User not found', 'NOT_FOUND', 404);

  // Edge Case: No Default Approver Assigned (CONOAPPR)
  if (!user.managerId || !user.manager) {
    throw new WorkflowError(
      'There are no approvers defined in your workflow. Please contact your Expense Administrator.',
      'CONOAPPR',
      400
    );
  }

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { allocations: true },
  });

  if (!expense) throw new WorkflowError('Expense not found', 'NOT_FOUND', 404);
  if (expense.userId !== userId) throw new WorkflowError('You can only submit your own expense reports', 'FORBIDDEN', 403);

  // Initial Step: Manager Approval
  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      status: EXPENSE_STATUS.PENDING,
      approvalStatus: APPROVAL_STATUS.PENDING_MANAGER_APPROVAL,
      paymentStatus: PAYMENT_STATUS.NOT_PAID,
      currentStep: WORKFLOW_STEP.MANAGER_APPROVAL,
      currentApproverId: user.managerId,
      reviewComment: null,
    },
  });

  const isResubmission = expense.approvalStatus === APPROVAL_STATUS.SENT_BACK;

  await prisma.workflowHistory.create({
    data: {
      expenseId,
      step: WORKFLOW_STEP.DRAFT,
      action: isResubmission ? WORKFLOW_ACTION.RESUBMIT : WORKFLOW_ACTION.SUBMIT,
      actorId: user.id,
      actorName: user.name || user.email,
      actorRole: user.role,
      comment: isResubmission
        ? 'Expense report corrected and resubmitted into approval workflow.'
        : 'Expense report submitted into approval workflow.',
    },
  });

  // Asynchronous email notification to 1-Up Manager
  if (user.manager?.email) {
    sendClaimSubmittedEmail({
      to: user.manager.email,
      managerName: user.manager.name,
      employeeName: user.name || user.email,
      expenseId: updated.id,
      category: updated.category,
      amount: updated.amount,
    }).catch((err) => console.error('[EMAIL DISPATCH ERROR]', err.message));
  }

  return updated;
}

/**
 * Executes an approval action on an expense report according to SVCORA_SpendX routing rules.
 */
export async function processExpenseApproval(expenseId, actorUser, { comment = '', forwardToUserId = null } = {}) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      user: { include: { manager: true } },
      currentApprover: true,
      allocations: { include: { costCenter: true } },
    },
  });

  if (!expense) throw new WorkflowError('Expense not found', 'NOT_FOUND', 404);

  if (expense.status === EXPENSE_STATUS.PAID || expense.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new WorkflowError('Expense report has already been paid and settled.', 'ALREADY_PAID', 409);
  }

  // Prevent self-approval (Separation of duties)
  if (expense.userId === actorUser.id) {
    throw new WorkflowError('You cannot approve your own expense report (Separation of Duties).', 'FORBIDDEN', 403);
  }

  const currentStep = expense.currentStep;

  // Handle Approve & Forward (Ad-Hoc Additional Approver)
  if (forwardToUserId) {
    const forwardUser = await prisma.user.findUnique({ where: { id: forwardToUserId } });
    if (!forwardUser) throw new WorkflowError('Forward-to user not found', 'NOT_FOUND', 404);
    if (forwardUser.role === 'EMPLOYEE') {
      throw new WorkflowError('Cannot forward to an employee without approval authority. Select a Manager, Finance, or Admin.', 'FORBIDDEN', 403);
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        currentApproverId: forwardUser.id,
      },
    });

    await prisma.workflowHistory.create({
      data: {
        expenseId,
        step: currentStep,
        action: WORKFLOW_ACTION.APPROVE_AND_FORWARD,
        actorId: actorUser.id,
        actorName: actorUser.name || actorUser.email,
        actorRole: actorUser.role,
        comment: comment ? `Forwarded to ${forwardUser.name || forwardUser.email}: ${comment}` : `Forwarded to ${forwardUser.name || forwardUser.email}`,
      },
    });

    return updated;
  }

  // STEP 1: MANAGER APPROVAL
  if (currentStep === WORKFLOW_STEP.MANAGER_APPROVAL) {
    const authority = await resolveActorAuthority(actorUser.id, expense.currentApproverId);
    if (!authority.isAuthorized && actorUser.role !== 'ADMIN') {
      throw new WorkflowError('You are not the designated manager or an active delegate for this expense report.', 'FORBIDDEN', 403);
    }

    const effectiveLimit = authority.isDelegate
      ? authority.delegatorLimit
      : actorUser.approvalLimit;

    // Check Limit-Based Routing: Does report total exceed manager signing threshold?
    const exceedsLimit = effectiveLimit !== null && expense.amount > effectiveLimit;

    if (exceedsLimit) {
      // Upward Hierarchy Traversal (Grandfather / Authorized Approver search)
      const higherApprover = await findNextAuthorizedApprover(actorUser.managerId, expense.amount);

      if (higherApprover) {
        // Escalate to higher authorized approver
        const updated = await prisma.expense.update({
          where: { id: expenseId },
          data: {
            approvalStatus: APPROVAL_STATUS.PENDING_AUTHORIZED_APPROVAL,
            currentStep: WORKFLOW_STEP.AUTHORIZED_APPROVAL,
            currentApproverId: higherApprover.id,
            reviewedById: actorUser.id,
            reviewedAt: new Date(),
          },
        });

        await prisma.workflowHistory.create({
          data: {
            expenseId,
            step: WORKFLOW_STEP.MANAGER_APPROVAL,
            action: WORKFLOW_ACTION.AUTO_ESCALATE,
            actorId: actorUser.id,
            actorName: actorUser.name || actorUser.email,
            actorRole: actorUser.role,
            delegateId: authority.isDelegate ? actorUser.id : null,
            delegateName: authority.isDelegate ? actorUser.name || actorUser.email : null,
            comment: `Manager approved (₹${expense.amount} exceeds limit of ₹${effectiveLimit}). Escalated to Authorized Approver: ${higherApprover.name || higherApprover.email}.`,
          },
        });

        return updated;
      } else {
        // Top of Hierarchy Exceeded: Fail-safe fallback auto-routes directly to Expense Processor (Finance)
        const updated = await prisma.expense.update({
          where: { id: expenseId },
          data: {
            approvalStatus: APPROVAL_STATUS.IN_ACCOUNTING_REVIEW,
            currentStep: WORKFLOW_STEP.PROCESSOR_REVIEW,
            currentApproverId: null, // Queued for Finance
            reviewedById: actorUser.id,
            reviewedAt: new Date(),
          },
        });

        await prisma.workflowHistory.create({
          data: {
            expenseId,
            step: WORKFLOW_STEP.MANAGER_APPROVAL,
            action: WORKFLOW_ACTION.AUTO_ESCALATE,
            actorId: actorUser.id,
            actorName: actorUser.name || actorUser.email,
            actorRole: actorUser.role,
            comment: `Manager approved. Amount (₹${expense.amount}) exceeds all configured hierarchy limits. Auto-routed to Expense Processor queue.`,
          },
        });

        return updated;
      }
    }

    // Manager had sufficient limit -> Check for Cost Object Approvals (COA)
    return routeToNextAfterManagerOrAuthorized(expense, actorUser, authority, comment);
  }

  // STEP 2: AUTHORIZED APPROVAL
  if (currentStep === WORKFLOW_STEP.AUTHORIZED_APPROVAL) {
    const authority = await resolveActorAuthority(actorUser.id, expense.currentApproverId);
    if (!authority.isAuthorized && actorUser.role !== 'ADMIN') {
      throw new WorkflowError('You are not the designated authorized approver or an active delegate.', 'FORBIDDEN', 403);
    }

    return routeToNextAfterManagerOrAuthorized(expense, actorUser, authority, comment, WORKFLOW_STEP.AUTHORIZED_APPROVAL);
  }

  // STEP 3: COST OBJECT APPROVAL (COA)
  if (currentStep === WORKFLOW_STEP.COST_OBJECT_APPROVAL) {
    // If expense has split allocations, check if actor is an owner of one of the cost centers
    const userCostCenterCodes = await prisma.costCenter.findMany({
      where: { managerId: actorUser.id },
      select: { id: true, code: true },
    });
    const ownedIds = new Set(userCostCenterCodes.map((c) => c.id));

    const isCOAOwner = expense.allocations.some((a) => ownedIds.has(a.costCenterId));
    if (!isCOAOwner && actorUser.role !== 'ADMIN') {
      throw new WorkflowError('You are not a designated Cost Object Approver for any allocation on this report.', 'FORBIDDEN', 403);
    }

    // Approve matching allocations
    for (const alloc of expense.allocations) {
      if (ownedIds.has(alloc.costCenterId) || actorUser.role === 'ADMIN') {
        await prisma.expenseAllocation.update({
          where: { id: alloc.id },
          data: {
            status: 'APPROVED',
            approvedById: actorUser.id,
            approvedAt: new Date(),
          },
        });
      }
    }

    // "Wait for All" Check: Have all allocations been approved?
    const refreshedAllocations = await prisma.expenseAllocation.findMany({
      where: { expenseId },
    });
    const allApproved = refreshedAllocations.every((a) => a.status === 'APPROVED');

    await prisma.workflowHistory.create({
      data: {
        expenseId,
        step: WORKFLOW_STEP.COST_OBJECT_APPROVAL,
        action: WORKFLOW_ACTION.APPROVE,
        actorId: actorUser.id,
        actorName: actorUser.name || actorUser.email,
        actorRole: actorUser.role,
        comment: comment || 'Cost Object allocation approved.',
      },
    });

    if (allApproved) {
      // Advance to Processor Review
      return prisma.expense.update({
        where: { id: expenseId },
        data: {
          approvalStatus: APPROVAL_STATUS.IN_ACCOUNTING_REVIEW,
          currentStep: WORKFLOW_STEP.PROCESSOR_REVIEW,
          currentApproverId: null,
        },
      });
    }

    // Still waiting for remaining COA branches
    return prisma.expense.findUnique({ where: { id: expenseId } });
  }

  // STEP 4: EXPENSE PROCESSOR REVIEW (Finance / AP Audit)
  if (currentStep === WORKFLOW_STEP.PROCESSOR_REVIEW) {
    if (actorUser.role !== 'FINANCE' && actorUser.role !== 'ADMIN') {
      throw new WorkflowError('Only Finance or Admin can perform final Expense Processor accounting review.', 'FORBIDDEN', 403);
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: EXPENSE_STATUS.APPROVED,
        approvalStatus: APPROVAL_STATUS.APPROVED,
        paymentStatus: PAYMENT_STATUS.PROCESSING_PAYMENT,
        currentStep: WORKFLOW_STEP.COMPLETED,
        currentApproverId: null,
        reviewedById: actorUser.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.workflowHistory.create({
      data: {
        expenseId,
        step: WORKFLOW_STEP.PROCESSOR_REVIEW,
        action: WORKFLOW_ACTION.APPROVE,
        actorId: actorUser.id,
        actorName: actorUser.name || actorUser.email,
        actorRole: actorUser.role,
        comment: comment || 'Final Expense Processor audit passed. Approved for payment processing.',
      },
    });

    return updated;
  }

  throw new WorkflowError(`Expense is in an invalid or completed step: ${currentStep}`, 'STATE_CONFLICT', 409);
}

async function routeToNextAfterManagerOrAuthorized(expense, actorUser, authority, comment, fromStep = WORKFLOW_STEP.MANAGER_APPROVAL) {
  // Check if Cost Object Approval is required
  const hasAllocations = expense.allocations && expense.allocations.length > 0;
  const distinctCostCenterIds = [...new Set((expense.allocations || []).map((a) => a.costCenterId))];

  // Check if cost center manager is different from the approving manager
  let needsCOA = false;
  if (hasAllocations) {
    const costCenters = await prisma.costCenter.findMany({
      where: { id: { in: distinctCostCenterIds } },
    });
    // If any cost center has a designated manager who is not the current actorUser
    needsCOA = costCenters.some((c) => c.managerId && c.managerId !== actorUser.id);
  }

  if (needsCOA) {
    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: {
        approvalStatus: APPROVAL_STATUS.PENDING_COA,
        currentStep: WORKFLOW_STEP.COST_OBJECT_APPROVAL,
        currentApproverId: null, // Shared parallel pool
        reviewedById: actorUser.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.workflowHistory.create({
      data: {
        expenseId: expense.id,
        step: fromStep,
        action: WORKFLOW_ACTION.APPROVE,
        actorId: actorUser.id,
        actorName: actorUser.name || actorUser.email,
        actorRole: actorUser.role,
        delegateId: authority.isDelegate ? actorUser.id : null,
        delegateName: authority.isDelegate ? actorUser.name || actorUser.email : null,
        comment: comment || 'Approved. Routed to Cost Object Approver(s) for budget authorization.',
      },
    });

    return updated;
  }

  // Advance straight to Expense Processor
  const updated = await prisma.expense.update({
    where: { id: expense.id },
    data: {
      approvalStatus: APPROVAL_STATUS.IN_ACCOUNTING_REVIEW,
      currentStep: WORKFLOW_STEP.PROCESSOR_REVIEW,
      currentApproverId: null, // Queued for Finance
      reviewedById: actorUser.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.workflowHistory.create({
    data: {
      expenseId: expense.id,
      step: fromStep,
      action: WORKFLOW_ACTION.APPROVE,
      actorId: actorUser.id,
      actorName: actorUser.name || actorUser.email,
      actorRole: actorUser.role,
      delegateId: authority.isDelegate ? actorUser.id : null,
      delegateName: authority.isDelegate ? actorUser.name || actorUser.email : null,
      comment: comment || 'Approved. Routed to Expense Processor queue for accounting review.',
    },
  });

  // Asynchronous email notification to Employee
  if (expense.user?.email) {
    sendClaimApprovedEmail({
      to: expense.user.email,
      employeeName: expense.user.name || expense.user.email,
      expenseId: updated.id,
      category: updated.category,
      amount: updated.amount,
      approverName: actorUser.name || actorUser.email,
    }).catch((err) => console.error('[EMAIL DISPATCH ERROR]', err.message));
  }

  return updated;
}

/**
 * Sends back an expense report to the employee (Rejection).
 * Requires a mandatory comment explaining the reason.
 */
export async function sendBackExpenseReport(expenseId, actorUser, comment) {
  if (!comment || typeof comment !== 'string' || !comment.trim()) {
    throw new WorkflowError('A comment is required when sending back an expense report.', 'VALIDATION_ERROR', 400);
  }

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { user: true },
  });

  if (!expense) throw new WorkflowError('Expense not found', 'NOT_FOUND', 404);

  if (expense.status === EXPENSE_STATUS.PAID || expense.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new WorkflowError('Paid expense reports cannot be sent back or rejected.', 'ALREADY_PAID', 409);
  }

  if (expense.userId === actorUser.id) {
    throw new WorkflowError('You cannot reject your own expense report.', 'FORBIDDEN', 403);
  }

  if (actorUser.role === 'EMPLOYEE') {
    throw new WorkflowError('Employees cannot reject expense reports.', 'FORBIDDEN', 403);
  }

  // Step-aware authorization for sending back
  if (expense.currentStep === WORKFLOW_STEP.MANAGER_APPROVAL) {
    const authority = await resolveActorAuthority(actorUser.id, expense.currentApproverId);
    if (!authority.isAuthorized && actorUser.role !== 'ADMIN') {
      throw new WorkflowError('You are not authorized to send back this expense report.', 'FORBIDDEN', 403);
    }
  } else if (expense.currentStep === WORKFLOW_STEP.PROCESSOR_REVIEW) {
    if (actorUser.role !== 'FINANCE' && actorUser.role !== 'ADMIN') {
      throw new WorkflowError('Only Finance or Admin can send back reports in Accounting Review.', 'FORBIDDEN', 403);
    }
  } else {
    const authority = await resolveActorAuthority(actorUser.id, expense.currentApproverId);
    if (!authority.isAuthorized && actorUser.role !== 'ADMIN') {
      throw new WorkflowError('You are not authorized to send back this expense report.', 'FORBIDDEN', 403);
    }
  }

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      status: EXPENSE_STATUS.REJECTED,
      approvalStatus: APPROVAL_STATUS.SENT_BACK,
      currentStep: WORKFLOW_STEP.DRAFT,
      currentApproverId: null,
      reviewComment: comment.trim(),
      reviewedById: actorUser.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.workflowHistory.create({
    data: {
      expenseId,
      step: expense.currentStep,
      action: WORKFLOW_ACTION.SEND_BACK,
      actorId: actorUser.id,
      actorName: actorUser.name || actorUser.email,
      actorRole: actorUser.role,
      comment: comment.trim(),
    },
  });

  // Asynchronous email notification to Employee
  if (expense.user?.email) {
    sendClaimSentBackEmail({
      to: expense.user.email,
      employeeName: expense.user.name || expense.user.email,
      expenseId: updated.id,
      category: updated.category,
      amount: updated.amount,
      reviewerName: actorUser.name || actorUser.email,
      comment: comment.trim(),
    }).catch((err) => console.error('[EMAIL DISPATCH ERROR]', err.message));
  }

  return updated;
}

/**
 * Processes payment disbursement (Final Settlement).
 */
export async function processExpensePayment(expenseId, actorUser, paymentReference = null) {
  if (actorUser.role !== 'FINANCE' && actorUser.role !== 'ADMIN') {
    throw new WorkflowError('Only Finance or Admin can process payment.', 'FORBIDDEN', 403);
  }

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { user: true },
  });
  if (!expense) throw new WorkflowError('Expense not found', 'NOT_FOUND', 404);

  if (expense.userId === actorUser.id) {
    throw new WorkflowError('You cannot disburse reimbursement to yourself.', 'FORBIDDEN', 403);
  }

  if (expense.status === EXPENSE_STATUS.PAID || expense.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new WorkflowError('Expense report has already been paid and settled.', 'ALREADY_PAID', 409);
  }

  if (expense.approvalStatus !== APPROVAL_STATUS.APPROVED) {
    throw new WorkflowError('Only fully approved expense reports can be processed for payment.', 'STATE_CONFLICT', 409);
  }

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      status: EXPENSE_STATUS.PAID,
      paymentStatus: PAYMENT_STATUS.PAID,
      paymentReference: paymentReference || null,
      paidById: actorUser.id,
      paidAt: new Date(),
    },
  });

  const commentText = paymentReference
    ? `Reimbursement payment confirmed and disbursed. Bank Transfer UTR: ${paymentReference}`
    : 'Reimbursement payment confirmed and disbursed.';

  await prisma.workflowHistory.create({
    data: {
      expenseId,
      step: WORKFLOW_STEP.COMPLETED,
      action: WORKFLOW_ACTION.PROCESS_PAYMENT,
      actorId: actorUser.id,
      actorName: actorUser.name || actorUser.email,
      actorRole: actorUser.role,
      comment: commentText,
    },
  });

  // Asynchronous email notification to Employee
  if (expense.user?.email) {
    sendClaimPaidEmail({
      to: expense.user.email,
      employeeName: expense.user.name || expense.user.email,
      expenseId: updated.id,
      category: updated.category,
      amount: updated.amount,
      utrReference: paymentReference,
    }).catch((err) => console.error('[EMAIL DISPATCH ERROR]', err.message));
  }

  return updated;
}
