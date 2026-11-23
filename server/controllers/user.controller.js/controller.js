import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../prisma/prisma.js';
import { sendPasswordResetEmail } from '../../services/emailService.js';

const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
};

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body || {};

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password and name are required' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'EMPLOYEE',
            },
        });

        const token = generateToken(newUser.id);

        return res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user.id);

        return res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const create = async (req, res) => {
    const { name, email, password } = req.body || {};

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                },
            });

            const token = generateToken(newUser.id);

            return { newUser, token };
        });

        return res.status(201).json({
            message: 'User created successfully',
            // token: result.token,
            user: {
                id: result.newUser.id,
                name: result.newUser.name,
                email: result.newUser.email,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const update = async (req, res) => {
    const userId = req.params.id;
    const { name, email, password, role } = req.body || {};

    try {
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        if (email && !isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        let hashedPassword;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
        }

        const updatedUser = await prisma.$transaction(async (tx) => {
            const userExists = await tx.user.findUnique({
                where: { id: parseInt(userId) },
            });

            if (!userExists) {
                throw new Error('User not found');
            }

            return tx.user.update({
                where: { id: parseInt(userId) },
                data: {
                    ...(name && { name }),
                    ...(email && { email }),
                    ...(password && { password: hashedPassword }),
                    ...(role && { role }),
                },
            });
        });

        return res.status(200).json({
            message: 'User updated successfully',
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
            },
        });
    } catch (err) {
        console.error(err);
        if (err.message === 'User not found') {
            return res.status(404).json({ error: err.message });
        }
        return res.status(500).json({ error: 'Server error' });
    }
};

const validRoles = new Set(['EMPLOYEE', 'MANAGER', 'FINANCE', 'ADMIN']);

export const updateRole = async (req, res) => {
    const targetUserId = Number(req.params.id);
    const { role } = req.body || {};

    if (!validRoles.has(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    if (!Number.isInteger(targetUserId)) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.id === targetUserId) {
        return res.status(403).json({ error: 'You cannot change your own role' });
    }

    try {
        const updatedUser = await prisma.$transaction(async (tx) => {
            const targetUser = await tx.user.findUnique({
                where: { id: targetUserId },
                select: { id: true, name: true, email: true, role: true },
            });

            if (!targetUser) {
                const error = new Error('User not found');
                error.code = 'USER_NOT_FOUND';
                throw error;
            }

            if (targetUser.role === 'ADMIN' && role !== 'ADMIN') {
                const adminCount = await tx.user.count({ where: { role: 'ADMIN' } });
                if (adminCount <= 1) {
                    const error = new Error('The last remaining admin cannot be demoted');
                    error.code = 'LAST_ADMIN';
                    throw error;
                }
            }

            return tx.user.update({
                where: { id: targetUserId },
                data: { role },
                select: { id: true, name: true, email: true, role: true },
            });
        });

        return res.status(200).json(updatedUser);
    } catch (error) {
        if (error.code === 'USER_NOT_FOUND') {
            return res.status(404).json({ error: error.message });
        }

        if (error.code === 'LAST_ADMIN') {
            return res.status(409).json({ error: error.message });
        }

        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ error: 'A valid email address is required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });

        if (!user) {
            return res.status(404).json({ error: 'No account registered with this email address' });
        }

        // Generate secure 6-digit numeric OTP (100000 to 999999)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetPasswordOtp: otp,
                resetPasswordExpires: expiry,
            },
        });

        // Send branded verification email
        await sendPasswordResetEmail(user.email, otp, user.name || 'User');

        return res.status(200).json({
            success: true,
            message: 'Verification code sent to your email address.',
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ error: 'Server error processing request' });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body || {};

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Email, verification code, and new password are required' });
        }

        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });

        if (!user) {
            return res.status(404).json({ error: 'User account not found' });
        }

        if (!user.resetPasswordOtp || !user.resetPasswordExpires) {
            return res.status(400).json({ error: 'No active password reset request found. Please request a new code.' });
        }

        if (new Date() > new Date(user.resetPasswordExpires)) {
            return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
        }

        if (user.resetPasswordOtp.trim() !== String(otp).trim()) {
            return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user and clear OTP
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordOtp: null,
                resetPasswordExpires: null,
            },
        });

        return res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now log in with your new password.',
        });
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ error: 'Server error processing password reset' });
    }
};
