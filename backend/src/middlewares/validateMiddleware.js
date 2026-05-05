import AppError from '../utils/AppError.js';

export const validate = (schema) => async (req, res, next) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        // Se passar da checagem forte, segue para o controlador original.
        return next();
    } catch (error) {
        // Zod gera erros com uma lista de `issues`.
        const errorMessage = error.errors ? error.errors.map((err) => err.message).join(', ') : 'Dados de entrada mal formatados.';
        return next(new AppError(errorMessage, 400));
    }
};
