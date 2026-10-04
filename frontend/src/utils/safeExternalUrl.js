// Links de metadados podem ser externos, mas nunca executáveis ou arquivos locais.
export const safeExternalUrl = (value) => {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
};
