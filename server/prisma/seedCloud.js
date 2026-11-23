import bcrypt from 'bcryptjs';
import prisma from './prisma.js';

async function seedCloud() {
  console.log('Seeding cloud Neon PostgreSQL database for SVCORA_SpendX...');

  const hashedPassword = await bcrypt.hash('Password@123', 10);

  // 1. Create or update Admin
  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Ayush (Administrator)',
        email: 'admin@svcinfosys.in',
        password: hashedPassword,
        role: 'ADMIN',
        department: 'Executive Leadership',
        costCenter: 'CC-103',
        approvalLimit: null,
        canApproveExceptions: true,
      },
    });
    console.log(`Created Cloud Admin: ${admin.email}`);
  }

  // 2. Create or update Manager (Riska)
  let manager = await prisma.user.findUnique({ where: { email: 'riska@svcinfosys.in' } });
  if (!manager) {
    manager = await prisma.user.create({
      data: {
        name: 'Riska (Line Manager)',
        email: 'riska@svcinfosys.in',
        password: hashedPassword,
        role: 'MANAGER',
        managerId: admin.id,
        approvalLimit: 2500.0,
        canApproveExceptions: true,
        department: 'Engineering',
        costCenter: 'CC-101',
      },
    });
    console.log(`Created Cloud Manager: ${manager.email}`);
  }

  // 3. Create or update Finance (Andy)
  let finance = await prisma.user.findUnique({ where: { email: 'andy@svcinfosys.in' } });
  if (!finance) {
    finance = await prisma.user.create({
      data: {
        name: 'Andy (Finance Processor)',
        email: 'andy@svcinfosys.in',
        password: hashedPassword,
        role: 'FINANCE',
        managerId: admin.id,
        approvalLimit: 10000.0,
        department: 'Finance & Accounting',
        costCenter: 'CC-103',
      },
    });
    console.log(`Created Cloud Finance: ${finance.email}`);
  }

  // 4. Create or update Employee (Sarah Connor)
  let employee = await prisma.user.findUnique({ where: { email: 'employee@svcinfosys.in' } });
  if (!employee) {
    employee = await prisma.user.create({
      data: {
        name: 'Sarah Connor (Employee)',
        email: 'employee@svcinfosys.in',
        password: hashedPassword,
        role: 'EMPLOYEE',
        managerId: manager.id,
        approvalLimit: 0,
        department: 'Engineering',
        costCenter: 'CC-101',
      },
    });
    console.log(`Created Cloud Employee: ${employee.email}`);
  }

  // 5. Create Cost Centers
  const costCenters = [
    { code: 'CC-101', name: 'Engineering & Development', managerId: manager.id },
    { code: 'CC-102', name: 'Marketing & Expansion', managerId: admin.id },
    { code: 'CC-103', name: 'General & Administrative', managerId: admin.id },
  ];

  for (const cc of costCenters) {
    const existing = await prisma.costCenter.findUnique({ where: { code: cc.code } });
    if (!existing) {
      await prisma.costCenter.create({ data: cc });
      console.log(`Created Cost Center: ${cc.code} - ${cc.name}`);
    }
  }

  console.log('✅ Cloud seeding completed successfully! All 4 personas and Cost Centers ready.');
  process.exit(0);
}

seedCloud().catch((err) => {
  console.error('Cloud seeding error:', err);
  process.exit(1);
});
