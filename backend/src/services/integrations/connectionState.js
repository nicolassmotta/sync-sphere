export const hasSpotifyConnection = (user) => (
    Boolean(user?.spotifyToken || user?.spotifyRefreshToken)
);
