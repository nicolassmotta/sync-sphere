import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

const SESSION_COOKIE_DAYS = 90;

const signToken = (id) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('ERRO FATAL: JWT_SECRET não está definida nas variáveis de ambiente.');
    }

    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '90d',
    });
};

const getSessionCookieOptions = () => {
    const cookieOptions = {
        expires: new Date(Date.now() + SESSION_COOKIE_DAYS * 24 * 60 * 60 * 1000),
        httpOnly: true,
        sameSite: 'strict',
    };

    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

    return cookieOptions;
};

export const buildSafeUserPayload = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
});

export const registerUser = ({ name, email, password }) => {
    return User.create({ name, email, password });
};

export const authenticateUser = async ({ email, password }) => {
    if (!email || !password) {
        throw new AppError('Por favor, informe e-mail e senha.', 400);
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password))) {
        throw new AppError('Email ou senha incorretos.', 401);
    }

    return user;
};

export const sendAuthSession = ({ user, statusCode, res }) => {
    const token = signToken(user._id);
    res.cookie('jwt', token, getSessionCookieOptions());

    res.status(statusCode).json({
        status: 'success',
        data: {
            user: buildSafeUserPayload(user),
        },
    });
};

export const clearAuthSession = (res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
    });
};
