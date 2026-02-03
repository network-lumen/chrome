// Import VaultManager for wallet operations
import { VaultManager } from './modules/vault/vault';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { Secp256k1HdWallet } from '@cosmjs/amino';



// Set panel behavior
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: false })
        .catch((error) => console.error(error));
}

// Create context menu on install
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
        if (typeof chrome !== 'undefined' && chrome.contextMenus) {
            chrome.contextMenus.create({
                id: 'openSidePanel',
                title: 'Open Side Panel',
                contexts: ['all']
            });
        }
    });
}

// Handle click
if (typeof chrome !== 'undefined' && chrome.contextMenus && chrome.contextMenus.onClicked) {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'openSidePanel' && tab?.windowId) {
            if (chrome.sidePanel && chrome.sidePanel.open) {
                chrome.sidePanel.open({ windowId: tab.windowId })
                    .catch(console.error);
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

// Message handler for provider requests from content scripts AND UI responses
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Handle provider requests from content scripts
        if (message.type === 'lumen-provider-request') {
            console.log('[Lumen Background] Received request:', message);

            handleProviderRequest(message, sender)
                .then(response => sendResponse(response))
                .catch(error => {
                    console.error('[Lumen Background] Error:', error);
                    sendResponse({ error: error.message || 'Request failed' });
                });

            return true; // Async response
        }

        // Handle user approval/rejection from side panel UI
        if (message.type === 'user-response') {
            handleUserResponse(message);
            sendResponse({ success: true });
            return false;
        }

        return false;
    });
}

/**
 * Process provider requests
 * @param {Object} message - Request from content script
 * @param {Object} sender - Chrome sender info (tab, frameId, etc.)
 * @returns {Promise<Object>} Response object with data or error
 */
async function handleProviderRequest(message: any, sender: any): Promise<any> {
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
    } catch (error: any) {
        console.error(`[Lumen Background] Error handling ${method}:`, error);
        return { error: error.message };
    }
}

/**
 * PLACEHOLDER HANDLERS
 * These should be implemented with actual wallet logic
 */

/**
 * Store for pending connection requests
 * Key: requestId, Value: { resolve, reject, origin, type }
 */
const pendRequest = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    origin: string;
    type: 'enable' | 'sign' | 'transaction';
}>();

function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function handleEnable(origin: string, _tab: any) {
    console.log('[Lumen] Enable request from:', origin);

    try {
        // Check state
        const isLocked = await checkWalletLocked();
        const connectedOrigins = await getConnectedOrigins();
        const isConnected = connectedOrigins.includes(origin);

        // If UNLOCKED and CONNECTED, return address immediately
        if (!isLocked && isConnected) {
            const address = await getWalletAddress();
            if (!address) {
                throw new Error('No wallet found');
            }
            return { data: [address] };
        }

        // Need user interaction (unlock OR approval OR both)
        // Show badge notification instead of opening popup
        console.log('[Lumen] Need user action - locked:', isLocked, 'connected:', isConnected);
        const requestId = generateRequestId();

        // Store pending request
        const requestData = {
            requestId,
            origin,
            permissions: ['View wallet address', 'Request transaction signatures'],
            type: isLocked ? 'pending-unlock-request' : 'approval-request',
            timestamp: Date.now()
        };

        await chrome.storage.local.set({
            pendingApprovalRequest: requestData
        });

        // Show badge to notify user
        if (chrome.action && chrome.action.setBadgeText) {
            await chrome.action.setBadgeText({ text: '1' });
            await chrome.action.setBadgeBackgroundColor({ color: '#f5d996ff' });
            await chrome.action.setTitle({
                title: `${origin} wants to connect to your wallet`
            });
        }

        console.log('[Lumen] Badge shown, waiting for user to open extension');

        return new Promise((resolve, reject) => {
            pendRequest.set(requestId, { resolve, reject, origin, type: 'enable' });

            // Timeout after 5 minutes
            setTimeout(() => {
                if (pendRequest.has(requestId)) {
                    pendRequest.delete(requestId);
                    // Clear badge and storage
                    chrome.storage.local.remove('pendingApprovalRequest');
                    chrome.action?.setBadgeText({ text: '' });
                    reject(new Error('Request timeout'));
                }
            }, 5 * 60 * 1000);
        });

    } catch (error: any) {
        console.error('[Lumen] Enable error:', error);
        return { error: error.message || 'Failed to connect wallet' };
    }
}

function handleUserResponse(message: any) {
    const { requestId, approved } = message;
    const pending = pendRequest.get(requestId);

    if (!pending) {
        console.warn('[Lumen] No pending request:', requestId);
        return;
    }

    pendRequest.delete(requestId);

    // Clear badge and storage
    chrome.storage.local.remove('pendingApprovalRequest');
    chrome.action?.setBadgeText({ text: '' });
    chrome.action?.setTitle({ title: 'Lumen Wallet' });

    if (approved) {
        addConnectedOrigin(pending.origin)
            .then(() => getWalletAddress())
            .then((address) => {
                if (!address) {
                    pending.reject(new Error('No wallet found'));
                } else {
                    pending.resolve({ data: [address] });
                }
            })
            .catch((error) => pending.reject(error));
    } else {
        pending.reject(new Error('User rejected the request'));
    }
}

/**
 * Helper functions for wallet state management
 */

async function checkWalletLocked(): Promise<boolean> {
    try {
        // Check if vault exists
        const hasVault = await VaultManager.hasWallet();
        if (!hasVault) {
            return true; // No vault = locked/needs setup
        }

        // Check if session is expired
        const isExpired = await VaultManager.isSessionExpired();
        return isExpired; // If session expired, wallet is locked
    } catch (error) {
        console.error('[Lumen] Error checking wallet lock status:', error);
        return true; // On error, assume locked for safety
    }
}

async function getWalletAddress(): Promise<string | null> {
    try {
        // Get wallets from vault (requires active session)
        const wallets = await VaultManager.getWallets();

        if (!wallets || wallets.length === 0) {
            return null;
        }

        // Return first wallet's address
        // TODO: Handle multi-wallet selection
        return wallets[0].address;
    } catch (error: any) {
        // Don't log error if it's just session expiration (expected when locked)
        if (!error.message?.includes('Session expired')) {
            console.error('[Lumen] Error getting wallet address:', error);
        }
        return null;
    }
}

async function getConnectedOrigins(): Promise<string[]> {
    const result = await chrome.storage.local.get(['connectedOrigins']) as { connectedOrigins?: string[] };
    return result.connectedOrigins || [];
}

async function addConnectedOrigin(origin: string): Promise<void> {
    const origins = await getConnectedOrigins();
    if (!origins.includes(origin)) {
        origins.push(origin);
        await chrome.storage.local.set({ connectedOrigins: origins });
        console.log('[Lumen] Added connected origin:', origin);
    }
}

// openSidePanel function removed - now using badge notification


async function handleGetAccounts(origin: string) {
    // Check if origin is connected
    const connectedOrigins = await getConnectedOrigins();

    if (!connectedOrigins.includes(origin)) {
        // Not connected, return empty array
        console.log('[Lumen] Get accounts - origin not connected:', origin);
        return {
            data: []
        };
    }

    // Connected, return wallet address
    const address = await getWalletAddress();

    console.log('[Lumen] Get accounts request from:', origin);
    return {
        data: address ? [address] : []
    };
}

async function handleGetChainId() {
    // Return Lumen chain ID
    console.log('[Lumen] Get chain ID request');
    return {
        data: 'lumen' // Lumen chain ID
    };
}

async function handleSendTransaction(params: any, origin: string, _tab: any) {
    console.log('[Lumen] Send transaction request:', params);

    const requestId = generateRequestId();

    // Store pending request
    const requestData = {
        requestId,
        origin,
        type: 'transaction-request',
        params,
        timestamp: Date.now()
    };

    await chrome.storage.local.set({ pendingApprovalRequest: requestData });

    // Show badge
    if (chrome.action) {
        chrome.action.setBadgeText({ text: '1' });
        chrome.action.setBadgeBackgroundColor({ color: '#f5d996ff' });
    }

    // Wait for user approval
    await new Promise((resolve, reject) => {
        pendRequest.set(requestId, { resolve, reject, origin, type: 'transaction' });

        setTimeout(() => {
            if (pendRequest.has(requestId)) {
                pendRequest.delete(requestId);
                chrome.storage.local.remove('pendingApprovalRequest');
                chrome.action?.setBadgeText({ text: '' });
                reject(new Error('Request timeout'));
            }
        }, 5 * 60 * 1000);
    });

    // Handle Generic/EVM Transaction Signing (Placeholder)
    console.log('[Lumen] Transaction approved by user. Generic/EVM signing not fully implemented.');
    return { error: 'Signing implementation pending for generic transactions' };
}

async function handleSignMessage(params: any, _origin: string, _tab: any) {
    // TODO: Open popup for user to review and sign message
    // TODO: Sign with private key
    // TODO: Return signature

    console.log('[Lumen] Sign message request:', params);
    throw new Error('Message signing not yet implemented');
}

async function handleSignTypedData(params: any, _origin: string, _tab: any) {
    // TODO: Parse and validate EIP-712 typed data
    // TODO: Open popup for user to review
    // TODO: Sign and return signature

    console.log('[Lumen] Sign typed data request:', params);
    throw new Error('Typed data signing not yet implemented');
}

async function handleAddChain(params: any, _origin: string, _tab: any) {
    // TODO: Validate chain parameters
    // TODO: Prompt user to add chain
    // TODO: Save to storage if approved

    console.log('[Lumen] Add chain request:', params);
    return { data: null };
}

async function handleSwitchChain(params: any, _origin: string, _tab: any) {
    // TODO: Check if chain exists
    // TODO: Switch active chain
    // TODO: Emit chainChanged event

    console.log('[Lumen] Switch chain request:', params);
    throw new Error('Chain switching not yet implemented');
}

// Cosmos-specific handlers for Lumen chain
async function handleCosmosGetKey(chainId: string) {
    // TODO: Return public key and address for specified chain
    console.log('[Lumen] Cosmos getKey request:', chainId);
    throw new Error('Cosmos key retrieval not yet implemented');
}

async function handleCosmosSignAmino(params: any, origin: string, _tab: any) {
    console.log('[Lumen] Cosmos signAmino request:', params);

    const requestId = generateRequestId();

    const requestData = {
        requestId,
        origin,
        type: 'transaction-request',
        params: { ...params, mode: 'amino' },
        timestamp: Date.now()
    };

    await chrome.storage.local.set({ pendingApprovalRequest: requestData });

    if (chrome.action) {
        chrome.action.setBadgeText({ text: '1' });
        chrome.action.setBadgeBackgroundColor({ color: '#f5d996ff' });
    }

    // Wait for user approval
    await new Promise((resolve, reject) => {
        pendRequest.set(requestId, { resolve, reject, origin, type: 'transaction' });

        setTimeout(() => {
            if (pendRequest.has(requestId)) {
                pendRequest.delete(requestId);
                chrome.storage.local.remove('pendingApprovalRequest');
                chrome.action?.setBadgeText({ text: '' });
                reject(new Error('Request timeout'));
            }
        }, 5 * 60 * 1000);
    });

    // User approved, sign logic
    try {
        const wallets = await VaultManager.getWallets();
        const signerAddress = params.signerAddress;

        // Find wallet
        const walletData = wallets.find(w => w.address === signerAddress);
        if (!walletData) throw new Error('Signer address not found in wallet');

        const wallet = await Secp256k1HdWallet.fromMnemonic(walletData.mnemonic, { prefix: 'lmn' });
        const result = await wallet.signAmino(signerAddress, params.signDoc);

        return { data: result };
    } catch (error: any) {
        console.error('SignAmino failed:', error);
        throw new Error(error.message || 'Signing failed');
    }
}

async function handleCosmosSignDirect(params: any, origin: string, _tab: any) {
    console.log('[Lumen] Cosmos signDirect request:', params);

    const requestId = generateRequestId();

    const requestData = {
        requestId,
        origin,
        type: 'transaction-request',
        params: { ...params, mode: 'direct' },
        timestamp: Date.now()
    };

    await chrome.storage.local.set({ pendingApprovalRequest: requestData });

    if (chrome.action) {
        chrome.action.setBadgeText({ text: '1' });
        chrome.action.setBadgeBackgroundColor({ color: '#f5d996ff' });
    }

    // Wait for user approval
    await new Promise((resolve, reject) => {
        pendRequest.set(requestId, { resolve, reject, origin, type: 'transaction' });

        setTimeout(() => {
            if (pendRequest.has(requestId)) {
                pendRequest.delete(requestId);
                chrome.storage.local.remove('pendingApprovalRequest');
                chrome.action?.setBadgeText({ text: '' });
                reject(new Error('Request timeout'));
            }
        }, 5 * 60 * 1000);
    });

    // User approved, sign logic
    try {
        const wallets = await VaultManager.getWallets();
        const signerAddress = params.signerAddress;

        // Find wallet
        const walletData = wallets.find(w => w.address === signerAddress);
        if (!walletData) throw new Error('Signer address not found in wallet');

        // Create signer
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(walletData.mnemonic, { prefix: 'lmn' });

        // Sign
        const result = await wallet.signDirect(signerAddress, params.signDoc);

        return { data: result };
    } catch (error: any) {
        console.error('Signing failed:', error);
        throw new Error(error.message || 'Signing failed');
    }
}

/**
 * Emit events to connected tabs
 * Call this when accounts or chain changes
 */
/* Commented out until needed - will use when implementing event emission
async function emitProviderEvent(eventName: string, data: any) {
    // TODO: Get all connected tabs
    // TODO: Send message to content scripts in those tabs
    console.log('[Lumen] Would emit event:', eventName, data);
}
*/
