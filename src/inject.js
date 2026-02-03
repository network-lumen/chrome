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
    console.warn('[Lumen] Provider already injected');
    return;
  }

  // Event listener storage for custom events
  const eventListeners = new Map();

  // Request tracking: Maps request IDs to their Promise resolve/reject functions
  const pendingRequests = new Map();
  let requestIdCounter = 0;

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
      console.warn('[Lumen] Invalid UUID in response, rejecting');
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
      }, 30000);
    });
  }

  /**
   * EIP-1193 Ethereum Provider API
   * Main interface that dApps use to interact with the wallet
   */
  const lumenProvider = {
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
     * Legacy support methods (some dApps may use these)
     */
    enable: async () => {
      return lumenProvider.request({ method: 'eth_requestAccounts' });
    },

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

  console.log('[Lumen] Provider injected successfully');
})();
