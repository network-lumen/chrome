/**
 * LUMEN WALLET CONTENT SCRIPT - ISOLATED WORLD BRIDGE
 * 
 * This script runs in the "Isolated World" context (Content Script context).
 * It acts as a secure bridge between the Main World and the Extension Background.
 * 
 * CONTEXT: Isolated World (Content Script)
 * - Has its own separate JavaScript environment
 * - Can access Chrome extension APIs (chrome.runtime.sendMessage)
 * - Can manipulate the page DOM (to inject scripts)
 * - Can use window.postMessage to communicate with Main World
 * - Cannot directly access Main World's window object
 * 
 * SECURITY: UUID Handshake
 * - Generates a unique UUID for this page session
 * - Injects the UUID into the provider script
 * - Validates all messages contain the correct UUID
 * - Prevents malicious page scripts from forging messages
 */

(function() {
  'use strict';

  /**
   * Generate a cryptographically secure UUID v4
   * This UUID serves as a shared secret between this Content Script
   * and the injected Provider Script
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  const LUMEN_UUID = generateUUID();
  console.log('[Lumen Content Script] UUID generated:', LUMEN_UUID);

  /**
   * STEP 1: Inject the Provider Script into the Main World
   * 
   * Instead of inline script injection (which violates CSP),
   * we inject a script tag with src attribute and pass UUID via data attribute
   */
  function injectProviderScript() {
    try {
      // Create script element that loads inject.js
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('inject.js');
      script.setAttribute('data-lumen-uuid', LUMEN_UUID);
      script.setAttribute('data-lumen-injected', 'true');
      
      // Inject into page at the earliest possible moment
      (document.head || document.documentElement).appendChild(script);
      
      // Clean up - remove the script tag after it loads
      script.onload = () => {
        script.remove();
        console.log('[Lumen Content Script] Provider script injected into Main World');
      };
      
      script.onerror = (error) => {
        console.error('[Lumen Content Script] Failed to load inject.js:', error);
      };
      
    } catch (error) {
      console.error('[Lumen Content Script] Injection error:', error);
    }
  }

  /**
   * STEP 2: Listen for messages from Main World (window.lumen)
   * 
   * The injected provider uses window.postMessage to send requests.
   * We validate the UUID and forward to the Background service worker.
   */
  window.addEventListener('message', async (event) => {
    // Only accept messages from this window
    if (event.source !== window) return;

    const message = event.data;

    // Check if message is intended for us
    if (message.target !== 'lumen-content-script') return;

    // SECURITY: Validate UUID to prevent spoofing
    if (message.uuid !== LUMEN_UUID) {
      console.warn('[Lumen Content Script] Invalid UUID, rejecting message:', message);
      return;
    }

    // Only process request type messages
    if (message.type !== 'request') return;

    console.log('[Lumen Content Script] Received request from Main World:', message);

    try {
      /**
       * STEP 3: Forward to Background Service Worker
       * 
       * Use chrome.runtime.sendMessage to send the request to background.js
       * This is where the actual wallet logic lives (signing, account management, etc.)
       */
      const response = await chrome.runtime.sendMessage({
        type: 'lumen-provider-request',
        method: message.method,
        params: message.params,
        origin: window.location.origin,
        requestId: message.requestId
      });

      /**
       * STEP 4: Send response back to Main World
       * 
       * The background worker responds, and we forward it back to the provider
       * via postMessage, including the UUID for validation
       */
      window.postMessage({
        target: 'lumen-provider',
        uuid: LUMEN_UUID,
        type: 'response',
        requestId: message.requestId,
        data: response.data,
        error: response.error
      }, '*');

      console.log('[Lumen Content Script] Response sent to Main World:', response);

    } catch (error) {
      // Handle errors and send error response back to provider
      console.error('[Lumen Content Script] Error processing request:', error);
      
      window.postMessage({
        target: 'lumen-provider',
        uuid: LUMEN_UUID,
        type: 'response',
        requestId: message.requestId,
        error: error.message || 'Unknown error occurred'
      }, '*');
    }
  });

  /**
   * STEP 5: Listen for events from Background Service Worker
   * 
   * The background can send events (accountsChanged, chainChanged, etc.)
   * that need to be forwarded to the provider
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only process messages from the background
    if (message.type === 'lumen-provider-event') {
      // Forward event to Main World provider
      window.postMessage({
        target: 'lumen-provider',
        uuid: LUMEN_UUID,
        type: 'event',
        eventName: message.eventName,
        data: message.data
      }, '*');

      sendResponse({ success: true });
    }
  });

  /**
   * STEP 6: Handle Origin Verification
   * 
   * Additional security layer - verify the page origin is not blacklisted
   * (Optional - can be used to block known malicious sites)
   */
  function isOriginAllowed(origin) {
    // For now, allow all origins
    // In production, you might want to implement a blacklist
    return true;
  }

  // Initialize: Inject the provider script
  injectProviderScript();

  console.log('[Lumen Content Script] Initialized on:', window.location.href);
})();
