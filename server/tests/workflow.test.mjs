import prisma from '../prisma/prisma.js';
import {
  submitExpenseReport,
  processExpenseApproval,
  sendBackExpenseReport,
  processExpensePayment,
  findNextAuthorizedApprover,
  WorkflowError,
} from '../services/workflowEngine.js';
import {
  EXPENSE_STATUS,
  APPROVAL_STATUS,
  PAYMENT_STATUS,
  WORKFLOW_STEP,
} from '../constants/expenseStatus.js';

async function runTests() {
  console.log('=== STARTING SVCORA_SpendX EXPENSE WORKFLOW VERIFICATION ===\n');

  // Load test users
  const employee = await prisma.user.findFirst({ where: { email: 'employee@svcinfosys.in' } });
  const manager = await prisma.user.findFirst({ where: { email: 'riska@svcinfosys.in' } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const finance = await prisma.user.findFirst({ where: { role: 'FINANCE' } });

  console.log(`Users loaded:
  - Employee: ${employee.email} (Reports to Manager ID: ${employee.managerId})
  - Manager: ${manager.email} (Limit: $${manager.approvalLimit}, Reports to Admin ID: ${manager.managerId})
  - Admin (Authorized Approver): ${admin.email} (Limit: ${admin.approvalLimit ?? 'Unlimited'})
  - Finance (Processor): ${finance.email}`);

  // TEST 1: Standard Manager Approval (Amount <= Manager Limit)
  console.log('\n--- TEST 1: Standard Manager Approval ($500 <= $2500 Limit) ---');
  const exp1 = await prisma.expense.create({
    data: {
      userId: employee.id,
      amount: 500.0,
      description: 'Client Lunch in City Center',
      category: 'Meals & Entertainment',
      date: new Date(),
      status: EXPENSE_STATUS.PENDING,
      approvalStatus: APPROVAL_STATUS.DRAFT,
      currentStep: WORKFLOW_STEP.DRAFT,
    },
  });

  const submitted1 = await submitExpenseReport(exp1.id, employee.id);
  console.log(`1. Submitted: status=${submitted1.approvalStatus}, step=${submitted1.currentStep}, assigneeId=${submitted1.currentApproverId}`);
  if (submitted1.approvalStatus !== APPROVAL_STATUS.PENDING_MANAGER_APPROVAL) {
    throw new Error('Expected PENDING_MANAGER_APPROVAL');
  }

  // Manager Approves
  const approvedByMgr1 = await processExpenseApproval(exp1.id, manager, { comment: 'Approved for client meeting.' });
  console.log(`2. Manager Approved: status=${approvedByMgr1.approvalStatus}, step=${approvedByMgr1.currentStep}`);
  if (approvedByMgr1.approvalStatus !== APPROVAL_STATUS.IN_ACCOUNTING_REVIEW) {
    throw new Error('Expected IN_ACCOUNTING_REVIEW after manager approval');
  }

  // Finance Processor Approves
  const approvedByFinance1 = await processExpenseApproval(exp1.id, finance, { comment: 'Receipts verified. Approved.' });
  console.log(`3. Finance Processor Approved: status=${approvedByFinance1.approvalStatus}, step=${approvedByFinance1.currentStep}`);
  if (approvedByFinance1.approvalStatus !== APPROVAL_STATUS.APPROVED) {
    throw new Error('Expected APPROVED');
  }

  // Finance Disburses Payment
  const paid1 = await processExpensePayment(exp1.id, finance);
  console.log(`4. Payment Processed: paymentStatus=${paid1.paymentStatus}, status=${paid1.status}`);
  if (paid1.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new Error('Expected PAID');
  }
  console.log('✔ TEST 1 PASSED: End-to-end standard approval lifecycle verified.');

  // TEST 2: Limit Exceeded -> Upward Hierarchy Traversal (Grandfather / Authorized Approver)
  console.log('\n--- TEST 2: Limit Exceeded -> Upward Hierarchy Escalation ($3,500 > $2,500 Limit) ---');
  const exp2 = await prisma.expense.create({
    data: {
      userId: employee.id,
      amount: 3500.0,
      description: 'Annual Tech Conference Travel & Lodging',
      category: 'Travel',
      date: new Date(),
      status: EXPENSE_STATUS.PENDING,
      approvalStatus: APPROVAL_STATUS.DRAFT,
      currentStep: WORKFLOW_STEP.DRAFT,
    },
  });

  await submitExpenseReport(exp2.id, employee.id);

  // Manager Approves ($3,500 > $2,500 manager limit -> MUST auto-escalate up to Admin)
  const escalated2 = await processExpenseApproval(exp2.id, manager, { comment: 'Approved. Exceeds my $2500 threshold.' });
  console.log(`1. Escalated Step: status=${escalated2.approvalStatus}, step=${escalated2.currentStep}, assigneeId=${escalated2.currentApproverId}`);
  if (escalated2.approvalStatus !== APPROVAL_STATUS.PENDING_AUTHORIZED_APPROVAL || escalated2.currentApproverId !== admin.id) {
    throw new Error('Expected PENDING_AUTHORIZED_APPROVAL assigned to Admin (higher manager)');
  }

  // Authorized Approver (Admin) Approves
  const approvedByAuth2 = await processExpenseApproval(exp2.id, admin, { comment: 'Authorized executive approval granted.' });
  console.log(`2. Authorized Approver Signed Off: status=${approvedByAuth2.approvalStatus}, step=${approvedByAuth2.currentStep}`);
  if (approvedByAuth2.approvalStatus !== APPROVAL_STATUS.IN_ACCOUNTING_REVIEW) {
    throw new Error('Expected IN_ACCOUNTING_REVIEW');
  }
  console.log('✔ TEST 2 PASSED: Upward hierarchy search correctly escalated $3,500 report to Authorized Approver.');

  // TEST 3: Send Back with Mandatory Comment (Concur Rejection)
  console.log('\n--- TEST 3: Send Back with Audit Comment ---');
  const exp3 = await prisma.expense.create({
    data: {
      userId: employee.id,
      amount: 200.0,
      description: 'Office Supplies Purchase',
      category: 'Supplies',
      date: new Date(),
      status: EXPENSE_STATUS.PENDING,
      approvalStatus: APPROVAL_STATUS.DRAFT,
      currentStep: WORKFLOW_STEP.DRAFT,
    },
  });

  await submitExpenseReport(exp3.id, employee.id);

  // Try send back without comment -> should throw
  let commentErrorThrown = false;
  try {
    await sendBackExpenseReport(exp3.id, manager, '');
  } catch (err) {
    commentErrorThrown = true;
  }
  if (!commentErrorThrown) throw new Error('Expected error for empty comment on send back');

  // Send back with valid comment
  const sentBack3 = await sendBackExpenseReport(exp3.id, manager, 'Tax invoice missing itemized breakdown. Please re-upload.');
  console.log(`1. Sent Back: status=${sentBack3.approvalStatus}, step=${sentBack3.currentStep}, comment="${sentBack3.reviewComment}"`);
  if (sentBack3.approvalStatus !== APPROVAL_STATUS.SENT_BACK || sentBack3.currentStep !== WORKFLOW_STEP.DRAFT) {
    throw new Error('Expected SENT_BACK status and DRAFT step for correction');
  }
  console.log('✔ TEST 3 PASSED: Mandatory comment enforced and report unlocked for employee correction.');

  // TEST 4: No Default Approver Assigned (CONOAPPR Edge Case)
  console.log('\n--- TEST 4: Missing Default Approver (CONOAPPR) ---');
  const orphanUser = await prisma.user.create({
    data: {
      email: 'orphan@svcinfosys.in',
      name: 'Orphan User',
      password: 'password',
      role: 'EMPLOYEE',
      managerId: null, // No manager
    },
  });

  const exp4 = await prisma.expense.create({
    data: {
      userId: orphanUser.id,
      amount: 150.0,
      description: 'Taxi Ride',
      category: 'Travel',
      date: new Date(),
    },
  });

  let conoapprThrown = false;
  try {
    await submitExpenseReport(exp4.id, orphanUser.id);
  } catch (err) {
    if (err.code === 'CONOAPPR') {
      conoapprThrown = true;
      console.log(`1. Caught expected SpendX workflow error: [${err.code}] ${err.message}`);
    }
  }

  // Cleanup orphan user & expense
  await prisma.expense.delete({ where: { id: exp4.id } });
  await prisma.user.delete({ where: { id: orphanUser.id } });

  if (!conoapprThrown) throw new Error('Expected CONOAPPR error');
  console.log('✔ TEST 4 PASSED: Missing default approver safely blocked submission with CONOAPPR.');

  // TEST 5: Verify Full Audit Trail in History
  console.log('\n--- TEST 5: Audit Trail Verification ---');
  const history1 = await prisma.workflowHistory.findMany({
    where: { expenseId: exp1.id },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Expense 1 History Records (${history1.length} events):`);
  history1.forEach((h, i) => {
    console.log(`  ${i + 1}. [${h.step}] ${h.action} by ${h.actorName} (${h.actorRole}): "${h.comment}"`);
  });
  if (history1.length < 4) throw new Error('Expected at least 4 workflow events');
  console.log('✔ TEST 5 PASSED: Full chronological audit trail preserved.');

  // Cleanup test expenses
  await prisma.expense.deleteMany({ where: { id: { in: [exp1.id, exp2.id, exp3.id] } } });

  console.log('\n=== ALL 5 SVCORA_SpendX WORKFLOW TESTS PASSED PERFECTLY! ===');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
