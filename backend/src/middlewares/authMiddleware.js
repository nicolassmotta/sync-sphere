import { LOCAL_USER_ID } from '../models/User.js';

/**
 * No modo local não há login: existe um único usuário implícito (o dono da
 * máquina). Este middleware apenas injeta esse usuário em `req.user`, mantendo
 * a assinatura `protect` usada pelas rotas para não precisar alterá-las.
 */
export const protect = (req, res, next) => {
    req.user = { _id: LOCAL_USER_ID, id: LOCAL_USER_ID };
    next();
};
