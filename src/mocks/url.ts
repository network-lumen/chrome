export const fileURLToPath = (url: URL | string) => {
    // In browser, "fileURLToPath" doesn't make sense for http: URLs.
    // We return the URL string itself so our mock fs can fetch it.
    if (typeof url === 'string') return url;
    return url.href || url.toString();
};

export const pathToFileURL = (path: string) => {
    return new URL('file://' + path);
};

export const URL = window.URL;

export default {
    fileURLToPath,
    pathToFileURL,
    URL
};
