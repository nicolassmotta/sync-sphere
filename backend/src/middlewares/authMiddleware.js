import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

// Middleware usado em rotas protegidas, permitindo apenas requisições com cookie JWT válido.
export const protect = async (req, res, next) => {
    try {
        let token;
        
        // A API prioriza o token via cookie HttpOnly.
        if (req.cookies && req.cookies.jwt) {
            token = req.cookies.jwt;
        } 
        // Alternativa por cabeçalho Bearer Token para testes manuais.
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(
                new AppError('Você não está logado. Faça login para acessar.', 401)
            );
        }

        if (!process.env.JWT_SECRET) {
            throw new Error('ERRO FATAL: JWT_SECRET não está definida nas variáveis de ambiente.');
        }
        // Verifica se o token não expirou ou não foi adulterado
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Confere se o usuário ainda existe no banco e não apagou a conta.
        const currentUser = await User.findById(decoded.id);
        if (!currentUser) {
            return next(
                new AppError(
                    'O usuário atrelado a este token não existe mais.',
                    401
                )
            );
        }

        // Coloca o usuário validado em req.user para uso nos controllers.
        req.user = currentUser;
        next();
    } catch (err) {
        // Erro padrão de JWT.
        return next(new AppError('Sessão expirada ou token inválido. Entre de novo.', 401));
    }
};
