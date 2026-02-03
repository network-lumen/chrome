
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
            // Forward to background script
            chrome.runtime.sendMessage(event.data, (response) => {
                // Forward back to inpage script
                window.postMessage({
                    source: 'lumen-content-script',
                    id: event.data.id,
                    ...response
                }, '*');
            });
        }
    });
})();
