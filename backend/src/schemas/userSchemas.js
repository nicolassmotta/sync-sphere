import { z } from 'zod';

/**
 * @constant registerSchema
 * @description Objeto de validação Zod que exige nome limpo, e-mail sintaticamente válido e senha min-6.
 */
export const registerSchema = z.object({
    body: z.object({
        name: z.string().min(3, "O nome precisa ter pelo menos 3 caracteres."),
        email: z.string().email("Formato de email inválido."),
        password: z.string().min(6, "A senha deve conter no mínimo 6 caracteres.")
    })
});

/**
 * @constant loginSchema
 * @description Validação unicamente do padrão de string para liberação inicial de tráfego pela API.
 */
export const loginSchema = z.object({
    body: z.object({
        email: z.string().email("Formato de email inválido."),
        password: z.string().min(6, "A senha deve conter no mínimo 6 caracteres.")
    })
});

/**
 * @constant transferStartSchema
 * @description Restringe e formata a inicialização de migração. Checa a presença formal
 * de um possível ID do Spotify válido (Length check).
 */
// Futura validação do POST na hora de começar uma transferência real
export const transferStartSchema = z.object({
    body: z.object({
        sourcePlaylistId: z.string().min(10, 'A playlist base do Spotify não está bem formulada.').optional(),
        sourcePlaylistIds: z
            .array(z.string().min(10, 'Uma das playlists do Spotify não está bem formulada.'))
            .min(1, 'Selecione ao menos uma playlist.')
            .optional(),
    }).refine((body) => body.sourcePlaylistId || body.sourcePlaylistIds?.length, {
        message: 'Selecione ao menos uma playlist do Spotify.',
        path: ['sourcePlaylistIds'],
    })
});
