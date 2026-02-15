
// This script bridges communication between the inpage script and the background script
(function () {
    // Inject inpage.js
    try {
        const container = document.head || document.documentElement;
        const scriptTag = document.createElement('script');
        scriptTag.src = chrome.runtime.getURL('inpage.js');
        scriptTag.onload = () => {
            scriptTag.remove();
        };
        container.insertBefore(scriptTag, container.children[0]);
    } catch (e) {
        console.error('Lumen: Injection failed', e);
    }

    // Listen for messages from the inpage script
    window.addEventListener('message', (event) => {
        if (event.data && event.data.source === 'lumen-inpage') {
            const message = event.data;
            const usePort = [
                'enable',
                'eth_requestAccounts',
                'eth_sendTransaction',
                'personal_sign',
                'eth_sign',
                'eth_signTypedData',
                'eth_signTypedData_v3',
                'eth_signTypedData_v4',
                'signDirect',
                'signAmino'
            ].includes(message.method);

            const requestPayload = {
                type: 'lumen-provider-request',
                method: message.method,
                params: message.params,
                origin: window.location.origin,
                requestId: message.id
            };

            const sendViaPort = () => {
                return new Promise((resolve, reject) => {
                    const port = chrome.runtime.connect({ name: 'lumen-provider' });
                    let settled = false;
                    const timeout = setTimeout(() => {
                        if (settled) return;
                        settled = true;
                        try { port.disconnect(); } catch {}
                        reject(new Error('Request timeout'));
                    }, 60 * 1000);

                    const cleanup = () => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timeout);
                        try { port.disconnect(); } catch {}
                    };

                    port.onMessage.addListener((response) => {
                        if (response?.requestId !== message.id) return;
                        cleanup();
                        resolve(response);
                    });

                    port.onDisconnect.addListener(() => {
                        if (settled) return;
                        const err = chrome.runtime.lastError?.message || 'Port disconnected';
                        cleanup();
                        reject(new Error(err));
                    });

                    port.postMessage(requestPayload);
                });
            };

            const send = usePort
                ? sendViaPort()
                : chrome.runtime.sendMessage(requestPayload);

            Promise.resolve(send)
                .then((response: any) => {
                    window.postMessage({
                        source: 'lumen-content-script',
                        id: message.id,
                        ...response
                    }, '*');
                })
                .catch((error: any) => {
                    window.postMessage({
                        source: 'lumen-content-script',
                        id: message.id,
                        error: error?.message || 'Unknown error occurred'
                    }, '*');
                });
        }
    });

    // Pre-warm background service worker
    try {
        chrome.runtime.sendMessage({ type: 'lumen-ping' }).catch(() => { });
    } catch (e) {
        // ignore
    }
})();
