export const promises = {
    readFile: async (path: any) => {
        // Force load the correct WASM from public/ if requested
        if (typeof path === 'string' && (path.includes('dilithium3') || path.endsWith('.wasm'))) {
            try {
                // Determine absolute URL for extension
                const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
                    ? chrome.runtime.getURL('dilithium3.wasm')
                    : '/dilithium3.wasm';

                console.log(`[MockFS] Intercepting read for ${path}, fetching from ${url}`);

                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                return Buffer.from(arrayBuffer);
            } catch (e) {
                console.error('[MockFS] Failed to fetch WASM override', e);
                // Fallback: return empty buffer so it fails downstream explicitly if needed, or try standard fetch
                return Buffer.from('');
            }
        }
        return Buffer.from('');
    },
    writeFile: async () => { },
    mkdir: async () => { },
};

export const readFile = (path: any, callback?: any) => {
    if (typeof callback !== 'function' && typeof path === 'function') callback = path; // Handle overload

    // Sync readFile is hard to mock with fetch, but SDK mostly uses promises or readFileSync?
    // If SDK uses readFileSync, we are in trouble unless we use XHR (deprecated) or assume async.
    // For now, let's assume async or return empty for sync.
    // If initWasm is async, it likely uses fs.promises.readFile.
    if (callback) callback(null, Buffer.from(''));
};
export const writeFile = () => { };
export const mkdir = () => { };

export default { promises, readFile, writeFile, mkdir };
