import crypto from 'crypto';

/**
 * Guarda o `code_verifier` do PKCE entre o login e o callback, indexado pelo
 * `state` assinado. Processo único local: um Map em memória com TTL basta, e
 * o verifier nunca trafega pela URL.
 */
const PKCE_TTL_MS = 10 * 60 * 1000;
const verifiers = new Map();

const prune = () => {
    const now = Date.now();
    for (const [key, entry] of verifiers) {
        if (now - entry.createdAt > PKCE_TTL_MS) verifiers.delete(key);
    }
};

export const createPkceChallenge = (state) => {
    prune();
    const verifier = crypto.randomBytes(64).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    verifiers.set(state, { verifier, createdAt: Date.now() });
    return challenge;
};

export const takePkceVerifier = (state) => {
    const entry = verifiers.get(state);
    verifiers.delete(state);
    return entry?.verifier || null;
};
