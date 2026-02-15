
// This script is injected into the web page to define window.lumen
(function () {
    const pendingRequests = new Map();

    const normalizePubKey = (pubKey: any): Uint8Array => {
        if (!pubKey) return new Uint8Array();
        if (pubKey instanceof Uint8Array) return pubKey;
        if (Array.isArray(pubKey)) return new Uint8Array(pubKey);
        if (typeof pubKey === 'object') {
            const values = Object.values(pubKey).filter(v => typeof v === 'number');
            return new Uint8Array(values as number[]);
        }
        return new Uint8Array();
    };

    const bytesToBase64 = (value: any): string => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        let bytes = value;
        if (Array.isArray(value)) {
            bytes = new Uint8Array(value);
        } else if (typeof value === 'object' && !(value instanceof Uint8Array)) {
            const values = Object.values(value).filter(v => typeof v === 'number');
            bytes = new Uint8Array(values as number[]);
        }
        if (!(bytes instanceof Uint8Array)) return '';
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

    const base64ToBytes = (value: any): Uint8Array => {
        if (!value) return new Uint8Array();
        if (value instanceof Uint8Array) return value;
        if (Array.isArray(value)) return new Uint8Array(value);
        if (typeof value === 'object') {
            const values = Object.values(value).filter(v => typeof v === 'number');
            return new Uint8Array(values as number[]);
        }
        if (typeof value !== 'string') return new Uint8Array();
        try {
            const binary = atob(value);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        } catch {
            return new Uint8Array();
        }
    };

    const normalizeSignDoc = (signDoc: any) => {
        if (!signDoc || typeof signDoc !== 'object') return signDoc;
        return {
            ...signDoc,
            accountNumber: signDoc.accountNumber?.toString?.() ?? signDoc.accountNumber,
            bodyBytes: bytesToBase64(signDoc.bodyBytes),
            authInfoBytes: bytesToBase64(signDoc.authInfoBytes),
        };
    };

    const normalizeSignResponse = (response: any) => {
        if (!response || !response.signed) return response;
        return {
            ...response,
            signed: {
                ...response.signed,
                bodyBytes: base64ToBytes(response.signed.bodyBytes),
                authInfoBytes: base64ToBytes(response.signed.authInfoBytes),
            }
        };
    };

    function sendRequest(method: string, params: any): Promise<any> {
        const id = Math.random().toString(36).substring(7);
        return new Promise((resolve, reject) => {
            pendingRequests.set(id, { resolve, reject });
            window.postMessage({
                source: 'lumen-inpage',
                id,
                method,
                params
            }, '*');
        });
    }

    window.addEventListener('message', (event) => {
        if (event.data && event.data.source === 'lumen-content-script' && event.data.id) {
            const request = pendingRequests.get(event.data.id);
            if (request) {
                pendingRequests.delete(event.data.id);
                if (event.data.error) {
                    request.reject(new Error(event.data.error));
                } else {
                    request.resolve(event.data.result);
                }
            }
        }
    });

    const lumen = {
        version: '1.0.1',
        enable: async (chainId: string) => {
            return await sendRequest('enable', { chainId });
        },
        getKey: async (chainId: string) => {
            return await sendRequest('getKey', { chainId });
        },
        experimentalSuggestChain: async (chainInfo: any) => {
            return await sendRequest('experimentalSuggestChain', { chainInfo });
        },
        getOfflineSigner: (chainId: string) => {
            return {
                getAccounts: async () => {
                    const key = await sendRequest('getKey', { chainId }) as any;
                    const keyData = key?.data ?? key ?? {};
                    return [{
                        address: keyData.bech32Address,
                        algo: keyData.algo,
                        pubkey: normalizePubKey(keyData.pubKey),
                    }];
                },
                signDirect: async (signerAddress: string, signDoc: any) => {
                    const response = await sendRequest('signDirect', { signerAddress, signDoc: normalizeSignDoc(signDoc) });
                    return normalizeSignResponse(response);
                },
                signAmino: async (signerAddress: string, signDoc: any) => {
                    return await sendRequest('signAmino', { signerAddress, signDoc });
                }
            };
        },
        getOfflineSignerAuto: async (chainId: string) => {
            return lumen.getOfflineSigner(chainId);
        }
    };

    // Define window.lumen
    Object.defineProperty(window, 'lumen', {
        value: lumen,
        writable: false,
        configurable: false
    });

    // Dispatch event so dApps can detect it
    window.dispatchEvent(new Event('lumen_keystone_ready'));
})();
