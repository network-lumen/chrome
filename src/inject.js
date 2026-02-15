/**
 * LUMEN WALLET PROVIDER - MAIN WORLD INJECTION SCRIPT
 * 
 * This script runs in the "Main World" context (the regular webpage context).
 * It creates the window.lumen provider object that dApps interact with.
 * 
 * CONTEXT: Main World
 * - Shares the same window object as the webpage's JavaScript
 * - Cannot access Chrome extension APIs (chrome.runtime, etc.)
 * - Can use window.postMessage to communicate with Content Script
 * 
 * SECURITY: UUID Handshake
 * - A unique UUID is embedded in this script at injection time
 * - All messages include this UUID for verification
 * - Prevents malicious page scripts from spoofing responses
 */

(function() {
  'use strict';

  // Read UUID from the script tag's data attribute
  // Content Script passes UUID via data-lumen-uuid attribute
  const scriptTag = document.querySelector('script[data-lumen-injected="true"]');
  const LUMEN_UUID = scriptTag ? scriptTag.getAttribute('data-lumen-uuid') : null;

  if (!LUMEN_UUID) {
    console.error('[Lumen] UUID not found, provider injection failed');
    return;
  }

  // Prevent double injection
  if (window.lumen) {
    return;
  }

  // Event listener storage for custom events
  const eventListeners = new Map();

  // Request tracking: Maps request IDs to their Promise resolve/reject functions
  const pendingRequests = new Map();
  let requestIdCounter = 0;
  const REQUEST_TIMEOUT_MS = 60 * 1000;

  const normalizePubKey = (pubKey) => {
    if (!pubKey) return new Uint8Array();
    if (pubKey instanceof Uint8Array) return pubKey;
    if (Array.isArray(pubKey)) return new Uint8Array(pubKey);
    if (typeof pubKey === 'object') {
      const values = Object.values(pubKey).filter((v) => typeof v === 'number');
      return new Uint8Array(values);
    }
    return new Uint8Array();
  };

  const bytesToBase64 = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    let bytes = value;
    if (Array.isArray(value)) {
      bytes = new Uint8Array(value);
    } else if (typeof value === 'object' && !(value instanceof Uint8Array)) {
      const values = Object.values(value).filter((v) => typeof v === 'number');
      bytes = new Uint8Array(values);
    }
    if (!(bytes instanceof Uint8Array)) return '';
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const base64ToBytes = (value) => {
    if (!value) return new Uint8Array();
    if (value instanceof Uint8Array) return value;
    if (Array.isArray(value)) return new Uint8Array(value);
    if (typeof value === 'object') {
      const values = Object.values(value).filter((v) => typeof v === 'number');
      return new Uint8Array(values);
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

  const normalizeSignDoc = (signDoc) => {
    if (!signDoc || typeof signDoc !== 'object') return signDoc;
    return {
      ...signDoc,
      accountNumber: signDoc.accountNumber?.toString?.() ?? signDoc.accountNumber,
      bodyBytes: bytesToBase64(signDoc.bodyBytes),
      authInfoBytes: bytesToBase64(signDoc.authInfoBytes),
    };
  };

  const normalizeSignResponse = (response) => {
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

  /**
   * Listen for responses from Content Script (Isolated World)
   * Messages come via window.postMessage with our UUID
   */
  window.addEventListener('message', (event) => {
    // Only accept messages from same origin
    if (event.source !== window) return;

    const message = event.data;

    // Verify message is for Lumen and has valid UUID
    if (message.target !== 'lumen-provider') return;
    if (message.uuid !== LUMEN_UUID) {
      return;
    }

    // Handle response for pending request
    if (message.type === 'response' && message.requestId !== undefined) {
      const pendingRequest = pendingRequests.get(message.requestId);
      if (pendingRequest) {
        if (message.error) {
          pendingRequest.reject(new Error(message.error));
        } else {
          pendingRequest.resolve(message.data);
        }
        pendingRequests.delete(message.requestId);
      }
    }

    // Handle wallet events (chainChanged, accountsChanged, etc.)
    if (message.type === 'event') {
      const listeners = eventListeners.get(message.eventName) || [];
      listeners.forEach(listener => {
        try {
          listener(message.data);
        } catch (error) {
          console.error('[Lumen] Event listener error:', error);
        }
      });
    }
  });

  /**
   * Send request to Content Script via postMessage
   * Returns a Promise that resolves when response is received
   */
  function sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = requestIdCounter++;
      
      // Store Promise resolver for this request
      pendingRequests.set(requestId, { resolve, reject });

      // Send message to Content Script (Isolated World)
      window.postMessage({
        target: 'lumen-content-script',
        uuid: LUMEN_UUID,
        type: 'request',
        requestId,
        method,
        params
      }, '*');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, REQUEST_TIMEOUT_MS);
    });
  }

  /**
   * EIP-1193 Ethereum Provider API
   * Main interface that dApps use to interact with the wallet
   */
  const lumenProvider = {
    version: '1.0.1',
    /**
     * EIP-1193 Standard Method
     * @param {Object} args - Request arguments with method and params
     * @returns {Promise} - Resolves with the result or rejects with error
     * 
     * Example Usage:
     * window.lumen.request({ method: 'eth_requestAccounts' })
     * window.lumen.request({ method: 'eth_sendTransaction', params: [txObj] })
     */
    request: async (args) => {
      if (!args || typeof args !== 'object') {
        throw new Error('Request args must be an object');
      }
      if (!args.method || typeof args.method !== 'string') {
        throw new Error('Request must include a method string');
      }

      return sendRequest(args.method, args.params);
    },

    /**
     * Event listener support (EIP-1193)
     * Standard events: connect, disconnect, accountsChanged, chainChanged, message
     */
    on: (eventName, callback) => {
      if (!eventListeners.has(eventName)) {
        eventListeners.set(eventName, []);
      }
      eventListeners.get(eventName).push(callback);
    },

    removeListener: (eventName, callback) => {
      if (eventListeners.has(eventName)) {
        const listeners = eventListeners.get(eventName);
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    },

    /**
     * Provider identification
     */
    isLumen: true,
    isConnected: () => true,

    /**
     * Keplr-style provider methods (Cosmos dApps)
     */
    enable: async (chainId) => {
      return sendRequest('enable', { chainId });
    },

    getKey: async (chainId) => {
      return sendRequest('getKey', { chainId });
    },

    getOfflineSigner: (chainId) => {
      return {
        getAccounts: async () => {
          const key = await sendRequest('getKey', { chainId });
          const keyData = key?.data ?? key ?? {};
          return [{
            address: keyData.bech32Address,
            algo: keyData.algo,
            pubkey: normalizePubKey(keyData.pubKey),
          }];
        },
        signDirect: async (signerAddress, signDoc) => {
          const response = await sendRequest('signDirect', { signerAddress, signDoc: normalizeSignDoc(signDoc) });
          return normalizeSignResponse(response);
        },
        signAmino: async (signerAddress, signDoc) => {
          return sendRequest('signAmino', { signerAddress, signDoc });
        }
      };
    },

    getOfflineSignerAuto: async (chainId) => {
      return lumenProvider.getOfflineSigner(chainId);
    },

    experimentalSuggestChain: async (chainInfo) => {
      return sendRequest('experimentalSuggestChain', { chainInfo });
    },

    /**
     * Legacy support methods (some dApps may use these)
     */

    send: (methodOrPayload, paramsOrCallback) => {
      // Support both legacy send formats
      if (typeof methodOrPayload === 'string') {
        return lumenProvider.request({ 
          method: methodOrPayload, 
          params: paramsOrCallback 
        });
      }
      // Legacy sendAsync format
      if (typeof paramsOrCallback === 'function') {
        lumenProvider.request(methodOrPayload)
          .then(result => paramsOrCallback(null, { result }))
          .catch(error => paramsOrCallback(error, null));
      }
    }
  };

  // Inject the provider into window
  Object.defineProperty(window, 'lumen', {
    value: lumenProvider,
    writable: false,
    configurable: false,
    enumerable: true
  });

  // Also expose as window.ethereum for maximum compatibility (if needed)
  // Uncomment if you want dApps to use Lumen as the default provider
  // if (!window.ethereum) {
  //   Object.defineProperty(window, 'ethereum', {
  //     value: lumenProvider,
  //     writable: false,
  //     configurable: false
  //   });
  // }

  // Dispatch initialization event
  window.dispatchEvent(new Event('lumen#initialized'));
  window.dispatchEvent(new Event('lumen_keystone_ready'));

})();
