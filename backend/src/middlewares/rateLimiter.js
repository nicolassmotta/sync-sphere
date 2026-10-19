import rateLimit from 'express-rate-limit';

// Cotas pensadas para uma pessoa usando o painel local: revisar dezenas de
// faixas ou migrar várias playlists por link não deve travar o aplicativo.
export const GLOBAL_REQUEST_LIMIT = 1000;
export const TRANSFER_START_LIMIT = 60;
export const TRANSFER_ACTION_LIMIT = 300;

// 1. Limite geral: navegação, consultas e prévias. Saúde e prontidão ficam de
// fora para o painel poder conferir se o aplicativo continua aberto.
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: GLOBAL_REQUEST_LIMIT,
    skip: (req) => req.method === 'GET' && ['/health', '/ready'].includes(req.path),
    message: { message: 'Limite global de acessos detectado nesta API. Aguarde 15 minutos.' }
});

// 2. Limite de sobrecarga operacional ao iniciar migrações.
export const transferLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: TRANSFER_START_LIMIT,
    message: { message: 'Muitas migrações iniciadas na última hora. Aguarde alguns minutos e tente de novo.' }
});

// 3. Ações sobre transferências existentes (retomar, tentar de novo, revisar).
export const transferActionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: TRANSFER_ACTION_LIMIT,
    message: { message: 'Muitas ações de retomada em sequência. Aguarde alguns minutos.' }
});
