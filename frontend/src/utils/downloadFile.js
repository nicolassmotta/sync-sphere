export const downloadFile = (content, filename, type = 'application/json') => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const getDownloadError = async (error, fallback) => {
    if (error.response?.data instanceof Blob) {
        try { return JSON.parse(await error.response.data.text()).message || fallback; } catch { return fallback; }
    }
    return error.response?.data?.message || fallback;
};
