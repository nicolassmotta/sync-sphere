import { providerHttpError } from '../../../services/integrations/providerHttpError.js';
import AppError from '../../../utils/AppError.js';
import logger from '../../../utils/logger.js';
import {
    describeProvider,
    getProvider,
    getProviderStatus,
    listProviders,
} from '../../../providers/registry.js';
import { resumeTransfersNeedingAuth } from '../../../services/transfer/transferQueueActions.js';

const PLAYLIST_ROLES = ['source', 'destination'];

const resumeWaitingTransfers = async (userId, provider) => {
    await resumeTransfersNeedingAuth({ userId, providerId: provider.id }).catch((error) => {
        logger.warn(`[${provider.label}] Não foi possível retomar transferências após reconectar: ${error.message}`);
    });
};

const getRoles = (provider) => PLAYLIST_ROLES.filter((role) => (
    role === 'source' ? provider.capabilities.read : provider.capabilities.write
));

export const getIntegrationStatus = async (req, res, next) => {
    try {
        const providers = await Promise.all(listProviders().map(async (provider) => ({
            ...describeProvider(provider),
            ...(await getProviderStatus(provider, { userId: req.user._id })),
            roles: getRoles(provider),
        })));

        res.status(200).json({
            status: 'success',
            data: {
                // Mapa por id, formato usado desde a v1.
                integrations: Object.fromEntries(providers.map(({ id, ...status }) => [id, status])),
                providers,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Developer token para o MusicKit JS (Apple Music) autorizar a conta no navegador.
 */
export const getMusicKitDeveloperToken = async (req, res, next) => {
    try {
        const provider = getProvider(req.params.provider);
        if (!provider.getMusicKitDeveloperToken) {
            throw new AppError(`${provider.label} não usa MusicKit.`, 400);
        }
        res.status(200).json({ status: 'success', data: { token: provider.getMusicKitDeveloperToken() } });
    } catch (error) {
        next(error);
    }
};

export const startProviderAuthorization = async (req, res, next) => {
    try {
        const provider = getProvider(req.params.provider);
        if (!provider.oauth) {
            throw new AppError(`${provider.label} não usa login OAuth. Configure as credenciais em Integrações.`, 400);
        }

        res.status(200).json({
            status: 'success',
            data: { url: await provider.oauth.getAuthorizationUrl({ req }) },
        });
    } catch (error) {
        next(error);
    }
};

export const providerCallback = async (req, res, next) => {
    try {
        const provider = getProvider(req.params.provider);
        if (!provider.oauth) {
            throw new AppError(`${provider.label} não usa login OAuth.`, 400);
        }

        const result = await provider.oauth.handleCallback({ query: req.query, req });
        if (result.connected) await resumeWaitingTransfers(result.userId, provider);

        return res.redirect(result.redirectUrl);
    } catch (error) {
        next(error);
    }
};

export const saveProviderCredentials = async (req, res, next) => {
    try {
        const provider = getProvider(req.params.provider);
        if (!provider.saveCredentials) {
            throw new AppError(`${provider.label} não aceita credenciais coladas no painel.`, 400);
        }

        await provider.saveCredentials({ values: req.body.values, userId: req.user._id });
        await resumeWaitingTransfers(req.user._id, provider);

        res.status(200).json({
            status: 'success',
            message: `${provider.label} configurado.`,
            data: { [provider.id]: await getProviderStatus(provider, { userId: req.user._id }) },
        });
    } catch (error) {
        next(error);
    }
};

export const disconnectProvider = async (req, res, next) => {
    try {
        const provider = getProvider(req.params.provider);
        await provider.disconnect?.({ userId: req.user._id });

        res.status(200).json({
            status: 'success',
            data: { [provider.id]: await getProviderStatus(provider, { userId: req.user._id }) },
        });
    } catch (error) {
        next(error);
    }
};

export const listProviderPlaylists = async (req, res, next) => {
    let provider;
    try {
        provider = getProvider(req.params.provider);
        if (!provider.capabilities.listUserPlaylists) {
            throw new AppError(`${provider.label} não lista playlists da conta. Cole o link da playlist.`, 400);
        }

        const result = await provider.listPlaylists({ userId: req.user._id });
        res.status(200).json({
            status: 'success',
            results: result.playlists.length,
            data: result,
        });
    } catch (error) {
        next(providerHttpError(error, provider, res));
    }
};

export const getProviderPlaylistTracks = async (req, res, next) => {
    let provider;
    try {
        provider = getProvider(req.params.provider);
        const playlistId = req.params.playlistId || req.query.playlistId;
        if (!playlistId) {
            throw new AppError(`Informe o link ou ID da playlist do ${provider.label}.`, 400);
        }

        const result = await provider.getPlaylistPreview({
            playlistId,
            userId: req.user._id,
            limit: req.query.limit,
        });

        res.status(200).json({
            status: 'success',
            results: result.tracks.length,
            data: result,
        });
    } catch (error) {
        next(providerHttpError(error, provider, res));
    }
};
