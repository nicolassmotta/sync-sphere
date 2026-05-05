import User from '../../../models/User.js';
import AppError from '../../../utils/AppError.js';
import {
    buildSpotifyAuthorizationUrl,
    exchangeSpotifyCode,
    getSpotifyPlaylistTracksPreview,
    listSpotifyUserPlaylists,
} from '../../../services/spotifyService.js';
import {
    createOAuthState,
    getFrontendOriginFromState,
    getFrontendRedirect,
    verifyOAuthState,
} from '../shared/oauthRedirect.js';

const SPOTIFY_OAUTH_INTENT = 'spotify_oauth';

export const getSpotifyAuthorization = async (req, res, next) => {
    try {
        const state = createOAuthState({ req, intent: SPOTIFY_OAUTH_INTENT });

        res.status(200).json({
            status: 'success',
            data: {
                url: buildSpotifyAuthorizationUrl(state),
            },
        });
    } catch (error) {
        next(error);
    }
};

export const spotifyCallback = async (req, res, next) => {
    try {
        const { code, state, error } = req.query;

        if (error) {
            return res.redirect(getFrontendRedirect(
                { tab: 'integrations', spotify: 'denied' },
                getFrontendOriginFromState({ state, intent: SPOTIFY_OAUTH_INTENT })
            ));
        }

        if (!code || !state) {
            return next(new AppError('Retorno do Spotify sem `code`/`state`.', 400));
        }

        const decoded = verifyOAuthState({ state, intent: SPOTIFY_OAUTH_INTENT });
        if (!decoded) {
            return next(new AppError('Parâmetro `state` do Spotify inválido.', 400));
        }

        const tokenData = await exchangeSpotifyCode(code);
        const user = await User.findById(decoded.id).select('+spotifyRefreshToken');
        if (!user) {
            return next(new AppError('Usuário do OAuth não encontrado.', 404));
        }

        user.spotifyToken = tokenData.access_token;
        user.spotifyRefreshToken = tokenData.refresh_token || user.spotifyRefreshToken;
        user.spotifyTokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
        await user.save({ validateBeforeSave: false });

        return res.redirect(getFrontendRedirect(
            { tab: 'integrations', spotify: 'connected' },
            decoded.frontendOrigin
        ));
    } catch (callbackError) {
        next(callbackError);
    }
};

export const disconnectSpotify = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        user.spotifyToken = null;
        user.spotifyRefreshToken = null;
        user.spotifyTokenExpiresAt = null;
        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            status: 'success',
            data: {
                spotify: {
                    connected: false,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getSpotifyPlaylists = async (req, res, next) => {
    try {
        const result = await listSpotifyUserPlaylists({ userId: req.user._id });

        res.status(200).json({
            status: 'success',
            results: result.playlists.length,
            data: result,
        });
    } catch (error) {
        next(new AppError(error.message || 'Não foi possível listar playlists do Spotify.', 400));
    }
};

export const getSpotifyPlaylistTracks = async (req, res, next) => {
    try {
        const result = await getSpotifyPlaylistTracksPreview({
            playlistId: req.params.playlistId,
            userId: req.user._id,
            limit: req.query.limit,
        });

        res.status(200).json({
            status: 'success',
            results: result.tracks.length,
            data: result,
        });
    } catch (error) {
        next(new AppError(error.message || 'Não foi possível listar faixas da playlist do Spotify.', 400));
    }
};
