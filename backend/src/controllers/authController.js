import {
    authenticateUser,
    buildSafeUserPayload,
    clearAuthSession,
    registerUser,
    sendAuthSession,
} from '../services/authSessionService.js';

/**
 * @function register
 * @description Controlador responsável por registrar um novo usuário no banco de dados. 
 * Usa o serviço de sessão para logar automaticamente logo após via cookie.
 * @param {import('express').Request} req - A requisição Express
 * @param {import('express').Response} res - A resposta Express
 * @param {import('express').NextFunction} next - Passa o erro ao interceptador global
 */
export const register = async (req, res, next) => {
    try {
        const newUser = await registerUser(req.body);
        sendAuthSession({ user: newUser, statusCode: 201, res });
    } catch (error) {
        next(error);
    }
};

/**
 * @function login
 * @description Controlador de Autenticação de Usuário (Login). Faz um comparativo seguro 
 * do hash de senha salvo no banco com a senha fornecida pela interface.
 * @param {import('express').Request} req - A requisição Express
 * @param {import('express').Response} res - A resposta Express
 * @param {import('express').NextFunction} next - Passa o erro ao interceptador global
 */
export const login = async (req, res, next) => {
    try {
        const user = await authenticateUser(req.body);
        sendAuthSession({ user, statusCode: 200, res });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// Rota GET /me: retorna os dados seguros baseados no cookie.
// ==========================================
/**
 * @function getMe
 * @description Rota utilitária de sessão. Recebe a chamada vazia do UI de tempo em tempo,
 * e, se o middleware detectou e liberou o JWT via cookie, essa rota simplesmente
 * recarrega as credenciais e confirma a persistência da sessão na interface.
 * @param {import('express').Request} req - A requisição Express (contém req.user validado pelo middleware)
 * @param {import('express').Response} res - A resposta Express
 * @param {import('express').NextFunction} next - Middleware de erro
 */
export const getMe = async (req, res, next) => {
    try {
        // O `req.user` já vem testado, aprovado e descriptografado diretamente do nosso authMiddleware (protect)
        res.status(200).json({
            status: 'success',
            data: {
                user: buildSafeUserPayload(req.user)
            }
        });
    } catch (error) {
         next(error);
    }
};

/**
 * @function logout
 * @description Controlador de encerramento da sessão ativa. Simplesmente escreve
 * um valor inofensivo e propositalmente curto no cookie `jwt`, limpando-o dos navegadores.
 * @param {import('express').Request} req - Objeto Express Request
 * @param {import('express').Response} res - Objeto Express Response
 */
export const logout = (req, res) => {
    clearAuthSession(res);
    res.status(200).json({ status: 'success' });
};
