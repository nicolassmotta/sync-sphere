import { z } from 'zod';
import { findProvider } from '../providers/registry.js';

// Valores antigos (`spotify_to_youtube`) ou `<origem>_to_<destino>`.
const directionSchema = z
    .string()
    .regex(/^[a-zA-Z]+_to_[a-zA-Z]+$/, 'Direção de transferência inválida.');
const providerSchema = z
    .string()
    .refine((id) => findProvider(id)?.id === id, 'Plataforma não suportada.');

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
        direction: directionSchema.optional(),
        sourceProvider: providerSchema.optional(),
        targetProvider: providerSchema.optional(),
        sourcePlaylistId: z.string().min(10, 'A playlist de origem não está bem formulada.').optional(),
        sourcePlaylistIds: z
            .array(z.string().min(10, 'Uma das playlists de origem não está bem formulada.'))
            .min(1, 'Selecione ao menos uma playlist.')
            .optional(),
    }).refine((body) => body.sourcePlaylistId || body.sourcePlaylistIds?.length, {
        message: 'Selecione ao menos uma playlist de origem.',
        path: ['sourcePlaylistIds'],
    }).refine((body) => (
        !body.sourceProvider
        || body.sourceProvider !== body.targetProvider
        || findProvider(body.sourceProvider)?.capabilities.sameProviderTransfer
    ), {
        message: 'Origem e destino precisam ser plataformas diferentes.',
        path: ['targetProvider'],
    })
});

const transferIdParams = z.object({
    transferId: z.string().min(1, 'Informe a transferência.').max(100),
});

export const transferIdSchema = z.object({
    params: transferIdParams,
});

export const transferTracksSchema = z.object({
    params: transferIdParams,
    query: z.object({
        status: z
            .string()
            .regex(/^(pending|matched|not_found|retry_queued|failed)(,(pending|matched|not_found|retry_queued|failed))*$/, 'Filtro de status inválido.')
            .optional(),
    }).passthrough(),
});

export const transferEstimateSchema = z.object({
    query: z.object({
        direction: directionSchema.optional(),
        targetProvider: providerSchema.optional(),
        count: z.coerce.number().int().min(0).max(100000),
    }).passthrough(),
});

export const providerCredentialsSchema = z.object({
    body: z.object({
        values: z.record(z.string().max(20000, 'Valor longo demais.')),
    }),
});
