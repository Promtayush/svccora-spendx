import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../prisma/prisma.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Access-control tests cannot run in production');
}

const BASE_URL = process.env.ACCESS_TEST_BASE_URL || 'http://localhost:3001';
const password = `AccessTest-${Math.random().toString(36).slice(2)}-Strong`;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userDefinitions = [
  ['employeeA', 'EMPLOYEE'],
  ['employeeB', 'EMPLOYEE'],
  ['manager', 'MANAGER'],
  ['finance', 'FINANCE'],
  ['admin', 'ADMIN'],
];
const users = {};
const registry = {
  userIds: new Set(),
  expenseIds: new Set(),
};
let failed = false;
let cleanupPromise;

const testUserWhere = {
  email: {
    startsWith: 'test-',
    endsWith: '@example.invalid',
  },
};

const trackUser = (user) => {
  registry.userIds.add(user.id);
  return user;
};

const trackExpense = (expense) => {
  if (expense?.id) {
    registry.expenseIds.add(expense.id);
  }
  return expense;
};

const deleteTestFixtures = async () => {
  const leftoverUsers = await prisma.user.findMany({
    where: testUserWhere,
    select: { id: true },
  });
  const userIds = [...new Set([
    ...registry.userIds,
    ...leftoverUsers.map((user) => user.id),
  ])];

  if (userIds.length > 0) {
    await prisma.expense.deleteMany({
      where: {
        OR: [
          { id: { in: [...registry.expenseIds] } },
          { userId: { in: userIds } },
          { reviewedById: { in: userIds } },
          { paidById: { in: userIds } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
};

const cleanup = () => {
  if (!cleanupPromise) {
    cleanupPromise = deleteTestFixtures().finally(() => {
      cleanupPromise = undefined;
    });
  }
  return cleanupPromise;
};

process.once('SIGINT', async () => {
  failed = true;
  try {
    await cleanup();
  } finally {
    process.exitCode = 130;
  }
});

const api = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
};

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const assertStatus = (response, expected) => {
  assert.equal(response.status, expected, `expected HTTP ${expected}, got ${response.status}`);
};

const check = async (name, callback) => {
  try {
    await callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : 'unknown failure';
    console.error(`FAIL ${name}: ${message}`);
  }
};

try {
  await cleanup();

  const health = await fetch(`${BASE_URL}/`);
  assertStatus(health, 200);

  const hashedPassword = await bcrypt.hash(password, 10);
  for (const [name, role] of userDefinitions) {
    const email = `test-${name}-${suffix}@example.invalid`;
    const user = trackUser(await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
    }));
    users[name] = user;
  }

  // Configure hierarchy for SpendX workflow
  await prisma.user.update({
    where: { id: users.employeeA.id },
    data: { managerId: users.manager.id },
  });
  await prisma.user.update({
    where: { id: users.employeeB.id },
    data: { managerId: users.manager.id },
  });
  await prisma.user.update({
    where: { id: users.manager.id },
    data: { managerId: users.admin.id, approvalLimit: 1000 },
  });
  await prisma.user.update({
    where: { id: users.finance.id },
    data: { managerId: users.manager.id },
  });
  await prisma.user.update({
    where: { id: users.admin.id },
    data: { approvalLimit: 100000 },
  });

  for (const [name] of userDefinitions) {
    const { response, body } = await api('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: users[name].email,
        password,
      }),
    });
    assertStatus(response, 200);
    assert.ok(body?.token, `${name} login did not return a token`);
    users[name].token = body.token;
  }

  let employeeClaim;
  let managerClaim;
  let financeClaim;
  let adminClaim;

  await check('employeeA creates a claim', async () => {
    const result = await api('/api/expenses', {
      method: 'POST',
      headers: authHeaders(users.employeeA.token),
      body: JSON.stringify({
        amount: 125,
        description: 'Access-control test claim',
        category: 'Testing',
        date: new Date().toISOString(),
      }),
    });
    assertStatus(result.response, 201);
    employeeClaim = trackExpense(result.body);
    assert.equal(employeeClaim.userId, users.employeeA.id);
  });

  await check('employeeB cannot see employeeA claim', async () => {
    const result = await api('/api/expenses', {
      headers: authHeaders(users.employeeB.token),
    });
    assertStatus(result.response, 200);
    assert.ok(!result.body.some((expense) => expense.id === employeeClaim.id));
  });

  await check('employee scope filters all and unknown scopes to own claims', async () => {
    for (const scope of ['all', 'unknown']) {
      const result = await api(`/api/expenses?scope=${scope}`, {
        headers: authHeaders(users.employeeA.token),
      });
      assertStatus(result.response, 200);
      assert.ok(result.body.every((expense) => expense.userId === users.employeeA.id));
    }
  });

  await check('employeeB cannot update employeeA claim', async () => {
    const result = await api(`/api/expenses/${employeeClaim.id}`, {
      method: 'PUT',
      headers: authHeaders(users.employeeB.token),
      body: JSON.stringify({ description: 'Should be denied' }),
    });
    assert.ok([403, 404].includes(result.response.status));
  });

  await check('employeeB cannot delete employeeA claim', async () => {
    const result = await api(`/api/expenses/${employeeClaim.id}`, {
      method: 'DELETE',
      headers: authHeaders(users.employeeB.token),
    });
    assert.ok([403, 404].includes(result.response.status));
  });

  await check('finance can see pending claims but cannot approve or reject them', async () => {
    const list = await api('/api/expenses', {
      headers: authHeaders(users.finance.token),
    });
    assertStatus(list.response, 200);
    const visibleClaim = list.body.find((expense) => expense.id === employeeClaim.id);
    assert.equal(visibleClaim.status, 'PENDING');

    for (const action of ['approve', 'reject']) {
      const result = await api(`/api/expenses/${employeeClaim.id}/${action}`, {
        method: 'PATCH',
        headers: authHeaders(users.finance.token),
        body: action === 'reject' ? JSON.stringify({ comment: 'Not allowed' }) : undefined,
      });
      assertStatus(result.response, 403);
    }

    const afterAttempts = await api(`/api/expenses?status=PENDING`, {
      headers: authHeaders(users.finance.token),
    });
    assertStatus(afterAttempts.response, 200);
    assert.equal(
      afterAttempts.body.find((expense) => expense.id === employeeClaim.id).status,
      'PENDING'
    );
  });

  for (const action of ['approve', 'reject', 'pay']) {
    await check(`employeeA cannot ${action} a claim`, async () => {
      const result = await api(`/api/expenses/${employeeClaim.id}/${action}`, {
        method: 'PATCH',
        headers: authHeaders(users.employeeA.token),
        body: action === 'reject' ? JSON.stringify({ comment: 'Not allowed' }) : undefined,
      });
      assertStatus(result.response, 403);
    });
  }

  await check('manager can see employeeA claim', async () => {
    const result = await api('/api/expenses', {
      headers: authHeaders(users.manager.token),
    });
    assertStatus(result.response, 200);
    assert.ok(result.body.some((expense) => expense.id === employeeClaim.id));
  });

  await check('manager approves employeeA claim', async () => {
    const result = await api(`/api/expenses/${employeeClaim.id}/approve`, {
      method: 'PATCH',
      headers: authHeaders(users.manager.token),
      body: JSON.stringify({ comment: 'Approved for client meeting' }),
    });
    assertStatus(result.response, 200);
    assert.equal(result.body.approvalStatus, 'IN_ACCOUNTING_REVIEW');
  });

  await check('finance processor approves employeeA claim in accounting review', async () => {
    const result = await api(`/api/expenses/${employeeClaim.id}/approve`, {
      method: 'PATCH',
      headers: authHeaders(users.finance.token),
      body: JSON.stringify({ comment: 'Accounting review passed' }),
    });
    assertStatus(result.response, 200);
    assert.equal(result.body.status, 'APPROVED');
    assert.equal(result.body.approvalStatus, 'APPROVED');
  });

  await check('manager creates a claim and cannot approve it', async () => {
    const created = await api('/api/expenses', {
      method: 'POST',
      headers: authHeaders(users.manager.token),
      body: JSON.stringify({
        amount: 50,
        description: 'Manager self-approval test',
        category: 'Testing',
        date: new Date().toISOString(),
      }),
    });
    assertStatus(created.response, 201);
    managerClaim = trackExpense(created.body);

    const approval = await api(`/api/expenses/${managerClaim.id}/approve`, {
      method: 'PATCH',
      headers: authHeaders(users.manager.token),
    });
    assertStatus(approval.response, 403);
  });

  await check('manager mine scope returns only the manager claim', async () => {
    const mine = await api('/api/expenses?scope=mine', {
      headers: authHeaders(users.manager.token),
    });
    assertStatus(mine.response, 200);
    assert.ok(mine.body.some((expense) => expense.id === managerClaim.id));
    assert.ok(!mine.body.some((expense) => expense.id === employeeClaim.id));

    const all = await api('/api/expenses', {
      headers: authHeaders(users.manager.token),
    });
    assertStatus(all.response, 200);
    assert.ok(all.body.some((expense) => expense.id === employeeClaim.id));
  });

  await check('finance cannot pay their own approved claim', async () => {
    const created = await api('/api/expenses', {
      method: 'POST',
      headers: authHeaders(users.finance.token),
      body: JSON.stringify({
        amount: 60,
        description: 'Finance self-payment test',
        category: 'Testing',
        date: new Date().toISOString(),
      }),
    });
    assertStatus(created.response, 201);
    financeClaim = trackExpense(created.body);

    const mgrApproval = await api(`/api/expenses/${financeClaim.id}/approve`, {
      method: 'PATCH',
      headers: authHeaders(users.manager.token),
      body: JSON.stringify({ comment: 'Manager ok' }),
    });
    assertStatus(mgrApproval.response, 200);

    const adminApproval = await api(`/api/expenses/${financeClaim.id}/approve`, {
      method: 'PATCH',
      headers: authHeaders(users.admin.token),
      body: JSON.stringify({ comment: 'Admin review ok' }),
    });
    assertStatus(adminApproval.response, 200);

    const payment = await api(`/api/expenses/${financeClaim.id}/pay`, {
      method: 'PATCH',
      headers: authHeaders(users.finance.token),
      body: JSON.stringify({ paymentReference: 'UTR-SELF-FIN' }),
    });
    assertStatus(payment.response, 403);
  });

  await check('admin cannot pay their own approved claim', async () => {
    const created = await api('/api/expenses', {
      method: 'POST',
      headers: authHeaders(users.admin.token),
      body: JSON.stringify({
        amount: 70,
        description: 'Admin self-payment test',
        category: 'Testing',
        date: new Date().toISOString(),
      }),
    });
    assertStatus(created.response, 201);
    adminClaim = trackExpense(created.body);

    await prisma.expense.update({
      where: { id: adminClaim.id },
      data: {
        status: 'APPROVED',
        approvalStatus: 'APPROVED',
        currentStep: 'COMPLETED',
      },
    });

    const payment = await api(`/api/expenses/${adminClaim.id}/pay`, {
      method: 'PATCH',
      headers: authHeaders(users.admin.token),
      body: JSON.stringify({ paymentReference: 'UTR-SELF-ADMIN' }),
    });
    assertStatus(payment.response, 403);
  });

  await check('finance and admin mine scope return only their own claims', async () => {
    for (const name of ['finance', 'admin']) {
      const mine = await api('/api/expenses?scope=mine', {
        headers: authHeaders(users[name].token),
      });
      assertStatus(mine.response, 200);
      assert.ok(mine.body.length > 0);
      assert.ok(mine.body.every((expense) => expense.userId === users[name].id));
      assert.ok(!mine.body.some((expense) => expense.id === employeeClaim.id));
    }
  });

  await check('manager cannot pay claim and finance can pay it with Bank UTR', async () => {
    const managerPayment = await api(`/api/expenses/${employeeClaim.id}/pay`, {
      method: 'PATCH',
      headers: authHeaders(users.manager.token),
    });
    assertStatus(managerPayment.response, 403);

    const financePayment = await api(`/api/expenses/${employeeClaim.id}/pay`, {
      method: 'PATCH',
      headers: authHeaders(users.finance.token),
      body: JSON.stringify({ paymentReference: 'UTR-FIN-12345678' }),
    });
    assertStatus(financePayment.response, 200);
    assert.equal(financePayment.body.status, 'PAID');
    assert.equal(financePayment.body.paymentReference, 'UTR-FIN-12345678');
  });

  for (const action of ['approve', 'reject']) {
    await check(`PAID claim cannot ${action} again`, async () => {
      const result = await api(`/api/expenses/${employeeClaim.id}/${action}`, {
        method: 'PATCH',
        headers: authHeaders(users.admin.token),
        body: action === 'reject' ? JSON.stringify({ comment: 'Should be denied' }) : undefined,
      });
      assertStatus(result.response, 409);
    });
  }

  await check('PUT cannot change expense status', async () => {
    const result = await api(`/api/expenses/${employeeClaim.id}`, {
      method: 'PUT',
      headers: authHeaders(users.employeeA.token),
      body: JSON.stringify({ status: 'PAID' }),
    });
    assert.ok([400, 409].includes(result.response.status));

    const list = await api('/api/expenses', {
      headers: authHeaders(users.employeeA.token),
    });
    const claim = list.body.find((expense) => expense.id === employeeClaim.id);
    assert.equal(claim.status, 'PAID');
  });

  await check('protected receipt endpoint requires auth and blocks unauthorized employee', async () => {
    const unauth = await api(`/api/expenses/${employeeClaim.id}/receipt`);
    assertStatus(unauth.response, 401);

    const forbidden = await api(`/api/expenses/${employeeClaim.id}/receipt`, {
      headers: authHeaders(users.employeeB.token),
    });
    assertStatus(forbidden.response, 403);
  });

  for (const [method, path, body] of [
    ['GET', '/api/expenses'],
    ['POST', '/api/expenses', {
      amount: 1,
      description: 'Unauthenticated',
      category: 'Testing',
      date: new Date().toISOString(),
    }],
    ['PUT', `/api/expenses/${employeeClaim.id}`, { description: 'Unauthenticated' }],
    ['DELETE', `/api/expenses/${employeeClaim.id}`],
    ['PATCH', `/api/expenses/${employeeClaim.id}/approve`],
    ['PATCH', `/api/expenses/${employeeClaim.id}/reject`, { comment: 'Unauthenticated' }],
    ['PATCH', `/api/expenses/${employeeClaim.id}/pay`],
  ]) {
    await check(`unauthenticated ${method} ${path} returns 401`, async () => {
      const result = await api(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      assertStatus(result.response, 401);
    });
  }

  await check('employeeA cannot update employeeB or change own role', async () => {
    const otherUser = await api(`/user/${users.employeeB.id}`, {
      method: 'PUT',
      headers: authHeaders(users.employeeA.token),
      body: JSON.stringify({ name: 'Should be denied' }),
    });
    assertStatus(otherUser.response, 403);

    const ownRole = await api(`/user/${users.employeeA.id}`, {
      method: 'PUT',
      headers: authHeaders(users.employeeA.token),
      body: JSON.stringify({ role: 'ADMIN' }),
    });
    assertStatus(ownRole.response, 403);
  });

  await check('signup ignores requested ADMIN role', async () => {
    const signupEmail = `test-signup-${suffix}@example.invalid`;
    const result = await api('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Signup Access Test',
        email: signupEmail,
        password,
        role: 'ADMIN',
      }),
    });
    assertStatus(result.response, 201);
    assert.equal(result.body.user.role, 'EMPLOYEE');
    if (result.body.user.id) trackUser(result.body.user);
  });

  await check('GET /users never returns password', async () => {
    const result = await api('/users', {
      headers: authHeaders(users.admin.token),
    });
    assertStatus(result.response, 200);
    assert.ok(result.body.every((user) => !Object.prototype.hasOwnProperty.call(user, 'password')));
    assert.ok(result.body.every((user) => Object.keys(user).sort().join(',') === 'createdAt,email,id,name,role'));
  });

  for (const name of ['employeeA', 'manager', 'finance']) {
    await check(`${name} cannot change user roles`, async () => {
      const result = await api(`/api/users/${users.employeeB.id}/role`, {
        method: 'PATCH',
        headers: authHeaders(users[name].token),
        body: JSON.stringify({ role: 'MANAGER' }),
      });
      assertStatus(result.response, 403);
    });
  }

  await check('admin can change employeeB to manager', async () => {
    const result = await api(`/api/users/${users.employeeB.id}/role`, {
      method: 'PATCH',
      headers: authHeaders(users.admin.token),
      body: JSON.stringify({ role: 'MANAGER' }),
    });
    assertStatus(result.response, 200);
    assert.equal(result.body.role, 'MANAGER');

    const me = await api('/api/me', {
      headers: authHeaders(users.employeeB.token),
    });
    assertStatus(me.response, 200);
    assert.equal(me.body.role, 'MANAGER');
  });

  await check('admin cannot change their own role', async () => {
    const result = await api(`/api/users/${users.admin.id}/role`, {
      method: 'PATCH',
      headers: authHeaders(users.admin.token),
      body: JSON.stringify({ role: 'EMPLOYEE' }),
    });
    assertStatus(result.response, 403);
    assert.equal(result.body.error, 'You cannot change your own role');
  });

  await check('invalid role value returns 400', async () => {
    const result = await api(`/api/users/${users.employeeB.id}/role`, {
      method: 'PATCH',
      headers: authHeaders(users.admin.token),
      body: JSON.stringify({ role: 'OWNER' }),
    });
    assertStatus(result.response, 400);
  });

  await check('last admin cannot be demoted', async () => {
    const lastAdmin = trackUser(await prisma.user.create({
      data: {
        name: 'Temporary second admin',
        email: `test-second-admin-${suffix}@example.invalid`,
        password: await bcrypt.hash(password, 10),
        role: 'ADMIN',
      },
    }));

    const demoteSecondAdmin = await api(`/api/users/${lastAdmin.id}/role`, {
      method: 'PATCH',
      headers: authHeaders(users.admin.token),
      body: JSON.stringify({ role: 'EMPLOYEE' }),
    });
    assertStatus(demoteSecondAdmin.response, 200);

    const demoteRemainingAdmin = await api(`/api/users/${users.admin.id}/role`, {
      method: 'PATCH',
      headers: authHeaders(users.admin.token),
      body: JSON.stringify({ role: 'EMPLOYEE' }),
    });
    assertStatus(demoteRemainingAdmin.response, 403);
    assert.equal(demoteRemainingAdmin.body.error, 'You cannot change your own role');
  });

  await check('unauthenticated role change returns 401', async () => {
    const result = await api(`/api/users/${users.employeeB.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'EMPLOYEE' }),
    });
    assertStatus(result.response, 401);
  });

  await check('GET /api/me returns the current user without password', async () => {
    const result = await api('/api/me', {
      headers: authHeaders(users.employeeA.token),
    });
    assertStatus(result.response, 200);
    assert.equal(result.body.id, users.employeeA.id);
    assert.equal(result.body.role, 'EMPLOYEE');
    assert.ok(!Object.prototype.hasOwnProperty.call(result.body, 'password'));
  });
} catch (error) {
  failed = true;
  const message = error instanceof Error ? error.message : 'unknown setup failure';
  console.error(`FAIL test setup: ${message}`);
} finally {
  try {
    await cleanup();
    await check('no leftover test users remain', async () => {
      const leftovers = await prisma.user.findMany({
        where: testUserWhere,
        select: { id: true },
      });
      assert.equal(leftovers.length, 0);
    });
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : 'cleanup failure';
    console.error(`FAIL cleanup: ${message}`);
  } finally {
    await prisma.$disconnect();
  }
}

process.exitCode = failed ? 1 : 0;
