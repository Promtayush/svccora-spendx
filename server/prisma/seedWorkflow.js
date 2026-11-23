import prisma from './prisma.js';

async function seed() {
  console.log('Seeding SVCORA_SpendX Workflow hierarchies and Cost Centers...');

  // Ensure Admin (Ayush) has unlimited limit and no manager (top of hierarchy)
  const admin = await prisma.user.updateMany({
    where: { role: 'ADMIN' },
    data: {
      approvalLimit: null, // Unlimited
      canApproveExceptions: true,
      department: 'Executive Leadership',
      costCenter: 'CC-103',
    },
  });

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  // Update Riska (Manager): reports to Admin (Ayush), limit = ₹2,500
  await prisma.user.updateMany({
    where: { email: 'riska@svcinfosys.in' },
    data: {
      managerId: adminUser?.id,
      approvalLimit: 2500.0,
      canApproveExceptions: true,
      department: 'Engineering',
      costCenter: 'CC-101',
    },
  });

  const managerUser = await prisma.user.findFirst({ where: { email: 'riska@svcinfosys.in' } });

  // Update Andy (Finance / Processor): department Finance
  await prisma.user.updateMany({
    where: { email: 'andy@svcinfosys.in' },
    data: {
      managerId: adminUser?.id,
      approvalLimit: 10000.0,
      department: 'Finance & Accounting',
      costCenter: 'CC-103',
    },
  });

  // Create Cost Centers if they don't exist
  const costCenters = [
    { code: 'CC-101', name: 'Engineering & Development', managerId: managerUser?.id },
    { code: 'CC-102', name: 'Marketing & Expansion', managerId: adminUser?.id },
    { code: 'CC-103', name: 'General & Administrative', managerId: adminUser?.id },
  ];

  for (const cc of costCenters) {
    const existing = await prisma.costCenter.findUnique({ where: { code: cc.code } });
    if (!existing) {
      await prisma.costCenter.create({
        data: cc,
      });
      console.log(`Created Cost Center: ${cc.code} - ${cc.name}`);
    } else {
      await prisma.costCenter.update({
        where: { code: cc.code },
        data: { managerId: cc.managerId },
      });
      console.log(`Updated Cost Center: ${cc.code}`);
    }
  }

  // Create a sample Employee if one doesn't exist
  let employee = await prisma.user.findUnique({ where: { email: 'employee@svcinfosys.in' } });
  if (!employee) {
    employee = await prisma.user.create({
      data: {
        email: 'employee@svcinfosys.in',
        name: 'Sarah Connor (Employee)',
        password: '$2a$12$e6m7qf4f7kR8/Jc0w9p9QOq4rD1l5s8h9v7b6n5m4c3x2z1a0s9d8', // hashed placeholder
        role: 'EMPLOYEE',
        managerId: managerUser?.id, // reports to Riska
        approvalLimit: 0,
        department: 'Engineering',
        costCenter: 'CC-101',
      },
    });
    console.log('Created sample employee: employee@svcinfosys.in (Reports to Riska)');
  }

  console.log('Seeding completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
