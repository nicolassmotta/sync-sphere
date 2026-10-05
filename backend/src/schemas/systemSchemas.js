import { z } from 'zod';
import { backupPasswordSchema } from '../services/system/backupService.js';

const providerParams = z.object({
    providerId: z.enum(['spotify', 'tidal'], { errorMap: () => ({ message: 'Escolha Spotify ou TIDAL.' }) }),
});
export const providerSetupQuerySchema = z.object({ params: providerParams });
export const providerSetupSchema = z.object({
    params: providerParams,
    body: z.object({
        clientId: z.string().trim()
            .min(5, 'Confira o Client ID copiado da plataforma.')
            .max(200, 'O Client ID informado é longo demais.')
            .regex(/^[a-zA-Z0-9_-]+$/, 'Client ID inválido.'),
    }),
}).refine((value) => value.params.providerId !== 'spotify' || /^[a-f0-9]{32}$/i.test(value.body.clientId), {
    message: 'O Client ID do Spotify deve ter 32 caracteres hexadecimais. Copie o valor completo do painel de desenvolvedores.',
    path: ['body', 'clientId'],
});
export const backupSchema = z.object({ body: z.object({ password: backupPasswordSchema }) });
