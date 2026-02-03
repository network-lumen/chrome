// Set side panel behavior
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((e) => console.error('Side panel error:', e));
}

// Create context menu on installation
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    if (typeof chrome !== 'undefined' && chrome.contextMenus) {
      chrome.contextMenus.create({
        id: "openSidePanel",
        title: "Open Side Panel",
        contexts: ["all"]
      });
    }
  });
}

// Handle context menu clicks
if (typeof chrome !== 'undefined' && chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "openSidePanel" && tab?.windowId) {
      if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
      }
    }
  });
}

/**
 * LUMEN WALLET PROVIDER - BACKGROUND SERVICE WORKER
 * 
 * This is the central hub for all wallet operations.
 * It receives requests from Content Scripts and processes them.
 * 
 * RESPONSIBILITIES:
 * - Handle provider requests (enable, sign, send transactions, etc.)
 * - Manage wallet state and storage
 * - Trigger popup/notifications for user confirmations
 * - Emit events to connected dApps (accountsChanged, chainChanged)
 */

// Message handler for provider requests
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only handle Lumen provider requests
    if (message.type !== 'lumen-provider-request') {
      return false; // Not our message
    }

    console.log('[Lumen Background] Received request:', message);

    // Handle async processing
    handleProviderRequest(message, sender)
      .then(response => sendResponse(response))
      .catch(error => {
        console.error('[Lumen Background] Error:', error);
        sendResponse({ error: error.message || 'Request failed' });
      });

    // Return true to indicate async response
    return true;
  });
}

/**
 * Process provider requests
 * @param {Object} message - Request from content script
 * @param {Object} sender - Chrome sender info (tab, frameId, etc.)
 * @returns {Promise<Object>} Response object with data or error
 */
async function handleProviderRequest(message, sender) {
  const { method, params, origin } = message;

  try {
    switch (method) {
      // Wallet connection/enable request
      case 'eth_requestAccounts':
      case 'enable':
        return await handleEnable(origin, sender.tab);

      // Get current accounts
      case 'eth_accounts':
        return await handleGetAccounts(origin);

      // Chain ID request
      case 'eth_chainId':
      case 'net_version':
        return await handleGetChainId();

      // Sign transaction
      case 'eth_sendTransaction':
        return await handleSendTransaction(params, origin, sender.tab);

      // Sign message
      case 'personal_sign':
      case 'eth_sign':
        return await handleSignMessage(params, origin, sender.tab);

      // Sign typed data (EIP-712)
      case 'eth_signTypedData':
      case 'eth_signTypedData_v3':
      case 'eth_signTypedData_v4':
        return await handleSignTypedData(params, origin, sender.tab);

      // Add network/chain
      case 'wallet_addEthereumChain':
        return await handleAddChain(params, origin, sender.tab);

      // Switch network/chain
      case 'wallet_switchEthereumChain':
        return await handleSwitchChain(params, origin, sender.tab);

      // Cosmos-specific methods (for Lumen chain)
      case 'cosmos_getKey':
      case 'getKey':
        return await handleCosmosGetKey(params?.chainId);

      case 'cosmos_signAmino':
      case 'signAmino':
        return await handleCosmosSignAmino(params, origin, sender.tab);

      case 'cosmos_signDirect':
      case 'signDirect':
        return await handleCosmosSignDirect(params, origin, sender.tab);

      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  } catch (error) {
    console.error(`[Lumen Background] Error handling ${method}:`, error);
    return { error: error.message };
  }
}

/**
 * PLACEHOLDER HANDLERS
 * These should be implemented with actual wallet logic
 */

async function handleEnable(origin, tab) {
  // TODO: Check if wallet is locked - if so, open unlock screen
  // TODO: Check if origin is already connected
  // TODO: If not, open approval popup for user to approve/reject connection
  // TODO: Return array of account addresses

  console.log('[Lumen] Enable request from:', origin);
  
  // Placeholder response - replace with actual wallet logic
  return {
    data: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'] // Example address
  };
}

async function handleGetAccounts(origin) {
  // TODO: Check if origin is connected
  // TODO: Return accounts only if connected, empty array otherwise
  
  console.log('[Lumen] Get accounts request from:', origin);
  return {
    data: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1']
  };
}

async function handleGetChainId() {
  // TODO: Return current chain ID from wallet state
  console.log('[Lumen] Get chain ID request');
  return {
    data: '0x1' // Mainnet
  };
}

async function handleSendTransaction(params, origin, tab) {
  // TODO: Validate transaction
  // TODO: Open popup for user confirmation
  // TODO: Sign and broadcast transaction
  // TODO: Return transaction hash
  
  console.log('[Lumen] Send transaction request:', params);
  throw new Error('Transaction signing not yet implemented');
}

async function handleSignMessage(params, origin, tab) {
  // TODO: Open popup for user to review and sign message
  // TODO: Sign with private key
  // TODO: Return signature
  
  console.log('[Lumen] Sign message request:', params);
  throw new Error('Message signing not yet implemented');
}

async function handleSignTypedData(params, origin, tab) {
  // TODO: Parse and validate EIP-712 typed data
  // TODO: Open popup for user to review
  // TODO: Sign and return signature
  
  console.log('[Lumen] Sign typed data request:', params);
  throw new Error('Typed data signing not yet implemented');
}

async function handleAddChain(params, origin, tab) {
  // TODO: Validate chain parameters
  // TODO: Prompt user to add chain
  // TODO: Save to storage if approved
  
  console.log('[Lumen] Add chain request:', params);
  return { data: null };
}

async function handleSwitchChain(params, origin, tab) {
  // TODO: Check if chain exists
  // TODO: Switch active chain
  // TODO: Emit chainChanged event
  
  console.log('[Lumen] Switch chain request:', params);
  throw new Error('Chain switching not yet implemented');
}

// Cosmos-specific handlers for Lumen chain
async function handleCosmosGetKey(chainId) {
  // TODO: Return public key and address for specified chain
  console.log('[Lumen] Cosmos getKey request:', chainId);
  throw new Error('Cosmos key retrieval not yet implemented');
}

async function handleCosmosSignAmino(params, origin, tab) {
  // TODO: Sign Amino transaction (legacy Cosmos tx format)
  console.log('[Lumen] Cosmos signAmino request:', params);
  throw new Error('Cosmos Amino signing not yet implemented');
}

async function handleCosmosSignDirect(params, origin, tab) {
  // TODO: Sign Direct transaction (Protobuf Cosmos tx format)
  console.log('[Lumen] Cosmos signDirect request:', params);
  throw new Error('Cosmos Direct signing not yet implemented');
}

/**
 * Emit events to connected tabs
 * Call this when accounts or chain changes
 */
async function emitProviderEvent(eventName, data) {
  // TODO: Get all connected tabs
  // TODO: Send message to content scripts in those tabs
  console.log('[Lumen] Would emit event:', eventName, data);
}
