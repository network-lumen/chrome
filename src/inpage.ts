
// This script is injected into the web page to define window.lumen
(function () {
    const pendingRequests = new Map();

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
                    return [{
                        address: key.bech32Address,
                        algo: key.algo,
                        pubkey: key.pubKey,
                    }];
                },
                signDirect: async (signerAddress: string, signDoc: any) => {
                    return await sendRequest('signDirect', { signerAddress, signDoc });
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
