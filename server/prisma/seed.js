import bcrypt from 'bcryptjs';
import prisma from './prisma.js';

async function main() {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;

    if (!email || !password) {
        throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            name: 'Administrator',
            email,
            password: hashedPassword,
            role: 'ADMIN',
        },
    });

    console.log(`Seeded administrator with id ${user.id}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
