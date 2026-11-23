import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import expenseRoutes from './routes/expenseRoutes.js';
import { authenticateUser } from './middlewares/authenticateUser.js';
import { requireRole } from './middlewares/requireRole.js';
import prisma from './prisma/prisma.js';

dotenv.config({ path: './.env' });

const jwtSecret = process.env.JWT_SECRET;

if (!process.env.DATABASE_URL || !jwtSecret) {
    throw new Error('DATABASE_URL and JWT_SECRET are required');
}

if (jwtSecret.length < 32 || /your-super-secret|changeme|^secret$/i.test(jwtSecret.trim())) {
    throw new Error('JWT_SECRET must be at least 32 characters and must not be a template value');
}

const app = express();
const port = process.env.PORT || 3001;
const parseCorsOrigin = (originEnv) => {
    if (!originEnv || originEnv === '*') return '*';
    const list = originEnv.split(',').map((item) => item.trim());
    return list.length === 1 ? list[0] : list;
};

const corsOrigin = parseCorsOrigin(process.env.CORS_ORIGIN || 'http://localhost:8080');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(cors({
    origin: corsOrigin,
    credentials: true,
}));
// Protected receipt streaming is handled via authenticated GET /api/expenses/:id/receipt
// Public static /uploads directory access is disabled for privacy and audit compliance

// App Routes
app.use('/', routes);
app.use('/api/expenses', expenseRoutes);

app.get('/', (req, res) => {
    res.send('Hello , Welcome to SVCORA_SpendX');
});

//Getting users
app.get('/users', authenticateUser, requireRole('ADMIN'), async (req, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const users = await prisma.user.findMany({
            where: search
                ? {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : undefined,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/me', authenticateUser, (req, res) => {
    res.json({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
    });
});

app.use((error, req, res, next) => {
    console.error('Unhandled server error:', error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
