import { SpotifyPlaylistAccessError } from '../spotify/spotifyErrors.js';
import AppError from '../../utils/AppError.js';
import { classifyProviderError, ERROR_KINDS, getRetryAfterMs } from '../../errors/providerErrors.js';

// Erros remotos não devem expor tokens ou detalhes internos na resposta HTTP.
export const providerHttpError = (error, provider, response) => {
    if (error instanceof AppError) return error;
    if (error instanceof SpotifyPlaylistAccessError) return new AppError(error.message, 400);
    const label = provider?.label || 'A plataforma';
    const kind = classifyProviderError(error);
    if (kind === ERROR_KINDS.AUTH) {
        return new AppError(`${label} precisa de reconexão. Abra Integrações e conecte novamente.`, 401);
    }
    if (kind === ERROR_KINDS.RATE_LIMITED) {
        const retryAfter = getRetryAfterMs(error);
        const projected = new AppError(`O ${label} limitou as requisições. Aguarde e tente novamente.`, 429);
        if (retryAfter !== null) {
            projected.retryAfterMs = retryAfter;
            response?.setHeader('Retry-After', String(Math.ceil(retryAfter / 1000)));
        }
        return projected;
    }
    if (Number(error?.status ?? error?.response?.status) === 404) {
        return new AppError(`A playlist não foi encontrada no ${label}. Confira o link e suas permissões.`, 404);
    }
    if (kind === ERROR_KINDS.PERMANENT) {
        return new AppError(`O ${label} não permitiu ler as faixas desta playlist. Confira o link e suas permissões.`, 400);
    }
    return new AppError(`Não foi possível consultar o ${label} agora. Tente novamente em instantes.`, 503);
};
