import rateLimit from 'express-rate-limit';

// 1. Limite geral leve: navegação padrão, pings e consultas.
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 150,                 // Limite confortável
    message: { message: 'Limite global de acessos detectado nesta API. Aguarde 15 minutos.' }
});

// 2. Limite crítico contra força bruta: senhas erradas e criação abusiva de contas.
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 8, // O IP será bloqueado na 9ª tentativa de errar senha ou criar múltiplas contas falsas dentro da mesma hora
    message: { message: 'Múltiplas tentativas falhas de autenticação. Bloqueio de defesa acionado neste IP por 1 hora.' }
});

// 3. Limite de sobrecarga operacional.
export const transferLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10,
    message: { message: 'Cota anti-spam excedida: você atingiu o máximo de transferências permitidas por hora (10). Aguarde.' }
});
