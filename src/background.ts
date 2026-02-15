// Import VaultManager for wallet operations
import { VaultManager } from './modules/vault/vault';
import { AminoTypes, createDefaultAminoConverters, defaultRegistryTypes } from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet, Registry, encodePubkey, makeAuthInfoBytes } from '@cosmjs/proto-signing';
import { Secp256k1HdWallet, getAminoPubkey } from '@cosmjs/amino';
import { fromBase64, fromBech32 } from '@cosmjs/encoding';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { Buffer } from 'buffer';
import * as LumenSDK from '@lumen-chain/sdk';
import { NetworkManager } from './modules/sdk/network';

// Initialize Network Manager
NetworkManager.getInstance();

const CHAIN_ID = 'lumen';
const PQC_PUBLIC_KEY_BYTES = 1952;
const PQC_PRIVATE_KEY_BYTES = 4000;
const defaultRegistry = new Registry(defaultRegistryTypes);
const defaultAminoTypes = new AminoTypes(createDefaultAminoConverters());
const REQUIRED_HOST_PERMISSIONS = [
    'https://rpc.lumen.chaintools.tech/*',
    'https://lumen.blocksync.me/*',
    'https://lumen-mainnet-rpc.mekonglabs.com/*',
    'https://rpc-lumen.onenov.xyz/*',
    'https://lumen-api.node9x.com/*',
    'https://api.lumen.chaintools.tech/*',
    'https://lumen-mainnet-api.mekonglabs.com/*',
    'https://lumen-api.linknode.org/*',
    'https://api-lumen.winnode.xyz/*'
];

const ensureUint8Array = (input: string | Uint8Array | undefined): Uint8Array => {
    if (!input) return new Uint8Array(0);
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.length === 0) return new Uint8Array(0);

        if (/^[0-9a-fA-F]+$/.test(trimmed)) {
            try {
                const buf = Buffer.from(trimmed, 'hex');
                if (buf.length > 0) return new Uint8Array(buf);
            } catch (e) {
                /* ignore hex decode errors */
            }
        }

        try {
            const buf = Buffer.from(trimmed, 'base64');
            if (buf.length > 0) return new Uint8Array(buf);
        } catch (e) {
            /* ignore base64 decode errors */
        }

        try {
            const binString = atob(trimmed);
            return new Uint8Array(binString.split('').map(c => c.charCodeAt(0)));
        } catch (e) {
            return new Uint8Array(0);
        }
    }
    return new Uint8Array(input as any);
};

const toNumber = (value: unknown, label: string): number => {
    if (value === undefined || value === null) {
        throw new Error(`Missing ${label}`);
    }
    if (typeof value === 'bigint') {
        return Number(value);
    }
    if (typeof value === 'object' && value !== null && 'toString' in value) {
        const maybeString = (value as { toString: () => string }).toString();
        const num = Number(maybeString);
        if (!Number.isFinite(num)) {
            throw new Error(`Invalid ${label}: ${maybeString}`);
        }
        return num;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
        throw new Error(`Invalid ${label}: ${String(value)}`);
    }
    return num;
};

const getPqcKeys = (walletData: any): { pqcPrivKey: Uint8Array; pqcPubKey: Uint8Array } => {
    const pqcData = ((walletData.pqcKey as any)?.publicKey || (walletData.pqcKey as any)?.public_key)
        ? walletData.pqcKey
        : ((walletData.pqc as any)?.publicKey || (walletData.pqc as any)?.public_key)
            ? walletData.pqc
            : (walletData.pqcKey || walletData.pqc);

    if (!pqcData) {
        throw new Error('Wallet is missing PQC key data. Please re-import your wallet.');
    }

    const rawPriv = pqcData.privateKey || pqcData.private_key || pqcData.encryptedPrivateKey;
    const rawPub = pqcData.publicKey || pqcData.public_key;

    if (!rawPriv || !rawPub) {
        throw new Error('PQC keys missing sub-properties. Please re-import your wallet.');
    }

    const pqcPrivKey = ensureUint8Array(rawPriv);
    const pqcPubKey = ensureUint8Array(rawPub);

    if (pqcPubKey.length !== PQC_PUBLIC_KEY_BYTES) {
        throw new Error(`Invalid PQC Public Key. Expected ${PQC_PUBLIC_KEY_BYTES} bytes, got ${pqcPubKey.length}.`);
    }

    if (pqcPrivKey.length !== PQC_PRIVATE_KEY_BYTES) {
        throw new Error(`Invalid PQC Private Key. Expected ${PQC_PRIVATE_KEY_BYTES} bytes, got ${pqcPrivKey.length}.`);
    }

    return { pqcPrivKey, pqcPubKey };
};



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

// Handle background alarms for periodic tasks
if (typeof chrome !== 'undefined' && chrome.alarms) {
    chrome.alarms.create('refresh-rpc', { periodInMinutes: 5 });
    chrome.alarms.create('keepalive', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'refresh-rpc') {
            NetworkManager.getInstance().refreshBestRpc();
        }
        if (alarm.name === 'keepalive') {
            chrome.storage.local.get(['connectedOrigins']).catch(() => { });
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
        if (message.type === 'lumen-ping') {
            sendResponse({ ok: true });
            return false;
        }
        // Handle provider requests from content scripts
        if (message.type === 'lumen-provider-request') {

            handleProviderRequest(message, sender)
                .then(response => sendResponse(response))
                .catch(error => {
                    console.error('[Lumen Background] Error:', error);
                    sendResponse({ error: error.message || 'Request failed' });
                });

            return true;
        }

        /* Handle user approval/rejection from side panel UI */
        if (message.type === 'user-response') {
            handleUserResponse(message);
            sendResponse({ success: true });
            return false;
        }

        /* Sync session from Popup to Background */
        if (message.type === 'sync-session') {
            VaultManager.unlock(message.password)
                .then(() => sendResponse({ success: true }))
                .catch(err => {
                    console.error('[Lumen Background] Session sync failed:', err);
                    sendResponse({ error: err.message });
                });
            return true;
        }

        /* Sync active wallet selection from UI */
        if (message.type === 'sync-active-wallet') {
            if (message.address) {
                chrome.storage.local.set({ [STORAGE_ACTIVE_WALLET]: message.address })
                    .then(() => sendResponse({ success: true }))
                    .catch(err => sendResponse({ error: err.message }));
                return true;
            }
            sendResponse({ error: 'Missing address' });
            return false;
        }

        return false;
    });
}

if (chrome?.runtime?.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
        prunePendingQueue().catch(() => {
        });
    });
}

if (chrome?.runtime?.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
        prunePendingQueue().catch(() => {
        });
    });
}

// Port-based messaging for long-running requests (e.g. sign/approve)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onConnect) {
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== 'lumen-provider') return;

        port.onMessage.addListener((message) => {
            if (message?.type !== 'lumen-provider-request') return;

            handleProviderRequest(message, port.sender)
                .then((response) => {
                    port.postMessage({
                        requestId: message.requestId,
                        data: response?.data,
                        error: response?.error
                    });
                })
                .catch((error) => {
                    port.postMessage({
                        requestId: message.requestId,
                        error: error?.message || 'Request failed'
                    });
                });
        });
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
        await prunePendingQueue();
        const ethMethods = new Set([
            'eth_requestAccounts',
            'eth_accounts',
            'eth_chainId',
            'net_version',
            'eth_sendTransaction',
            'personal_sign',
            'eth_sign',
            'eth_signTypedData',
            'eth_signTypedData_v3',
            'eth_signTypedData_v4',
            'wallet_addEthereumChain',
            'wallet_switchEthereumChain'
        ]);
        if (ethMethods.has(method)) {
            throw new Error('Ethereum methods are disabled in this Cosmos-only wallet.');
        }

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
                return await handleCosmosGetKey(params?.chainId, origin);

            case 'cosmos_signAmino':
            case 'signAmino':
                return await handleCosmosSignAmino(params, origin, sender.tab);

            case 'cosmos_signDirect':
            case 'signDirect':
                return await handleCosmosSignDirect(params, origin, sender.tab);

            case 'experimentalSuggestChain':
                return { data: null };

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

const REQUEST_TIMEOUT_MS = 60 * 1000;
type PendingRequestData = {
    requestId: string;
    origin: string;
    permissions: string[];
    type: 'approval-request' | 'pending-unlock-request' | 'transaction-request';
    params?: any;
    timestamp?: number;
};

let isPopupOpening = false;
let isPanelOpening = false;
let popupWindowId: number | null = null;
const STORAGE_POPUP_WINDOW_ID = 'lumen_popup_window_id';

const STORAGE_ACTIVE_WALLET = 'activeWalletAddress';
const STORAGE_CONNECTED_ORIGINS = 'connectedOrigins';
const STORAGE_PENDING_QUEUE = 'pendingApprovalQueue';

const originToPattern = (origin: string): string | null => {
    try {
        const url = new URL(origin);
        return `${url.origin}/*`;
    } catch {
        return null;
    }
};

async function ensureSitePermission(origin: string): Promise<void> {
    if (!chrome.permissions) return;
    const pattern = originToPattern(origin);
    if (!pattern) return;
    const perms = { origins: [pattern] };
    const granted = await chrome.permissions.contains(perms);
    if (!granted) {
        throw new Error('Site permission not granted.');
    }
}

async function getActiveWalletAddress(): Promise<string | null> {
    try {
        const result = await chrome.storage.local.get([STORAGE_ACTIVE_WALLET]) as { activeWalletAddress?: string };
        return result.activeWalletAddress || null;
    } catch {
        return null;
    }
}

async function getPendingQueue(): Promise<PendingRequestData[]> {
    const result = await chrome.storage.local.get(STORAGE_PENDING_QUEUE) as { pendingApprovalQueue?: PendingRequestData[] };
    return Array.isArray(result.pendingApprovalQueue) ? result.pendingApprovalQueue : [];
}

async function setPendingQueue(queue: PendingRequestData[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_PENDING_QUEUE]: queue });
    const count = queue.length;
    if (chrome.action && chrome.action.setBadgeText) {
        await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
        await chrome.action.setBadgeBackgroundColor({ color: count > 0 ? '#f5d996ff' : '#00000000' });
        await chrome.action.setTitle({
            title: count > 0 ? `Lumen Wallet (${count} pending request${count > 1 ? 's' : ''})` : 'Lumen Wallet'
        });
    }
}

async function prunePendingQueue(): Promise<void> {
    const queue = await getPendingQueue();
    if (!queue.length) return;
    const now = Date.now();
    const fresh: PendingRequestData[] = [];
    for (const item of queue) {
        const timestamp = item.timestamp ?? 0;
        const isStale = timestamp > 0 && now - timestamp > REQUEST_TIMEOUT_MS;
        if (isStale) {
            const pending = pendRequest.get(item.requestId);
            if (pending) {
                pending.reject(new Error('Request timeout'));
                pendRequest.delete(item.requestId);
            }
            continue;
        }
        fresh.push(item);
    }
    if (fresh.length !== queue.length) {
        await setPendingQueue(fresh);
    }
}

async function enqueuePendingRequest(requestData: PendingRequestData): Promise<void> {
    await prunePendingQueue();
    const queue = await getPendingQueue();
    const nextQueue = [requestData, ...queue.filter((item) => item.requestId !== requestData.requestId)];
    await setPendingQueue(nextQueue);
}

async function removePendingRequest(requestId: string): Promise<void> {
    const queue = await getPendingQueue();
    const nextQueue = queue.filter((item) => item.requestId !== requestId);
    await setPendingQueue(nextQueue);
}

async function openApprovalPopup(tab?: chrome.tabs.Tab) {
    if (typeof chrome === 'undefined' || !chrome.windows) return;

    // Prevent race conditions
    if (isPopupOpening || isPanelOpening) return;

    try {
        // Prefer side panel for consistency
        if (chrome.sidePanel?.open) {
            isPanelOpening = true;
            try {
                if (tab?.id !== undefined) {
                    await chrome.sidePanel.open({ tabId: tab.id });
                    return;
                }
                const win = await chrome.windows.getCurrent();
                if (win?.id) {
                    await chrome.sidePanel.open({ windowId: win.id });
                    return;
                }
            } catch (e) {
            } finally {
                setTimeout(() => {
                    isPanelOpening = false;
                }, 500);
            }
        }

        isPopupOpening = true;
        // Try to re-focus an existing approval popup (avoid duplicates)
        let storedId: number | null = popupWindowId;
        if (chrome.storage?.session) {
            const stored = await chrome.storage.session.get(STORAGE_POPUP_WINDOW_ID) as { lumen_popup_window_id?: number };
            storedId = stored?.lumen_popup_window_id ?? storedId;
        }
        if (storedId) {
            try {
                const win = await chrome.windows.get(storedId);
                if (win?.id) {
                    popupWindowId = win.id;
                    await chrome.windows.update(win.id, { focused: true });
                    return;
                }
            } catch {
                popupWindowId = null;
                if (chrome.storage?.session) {
                    await chrome.storage.session.remove(STORAGE_POPUP_WINDOW_ID);
                }
            }
        }

        const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['popup'] });
        const existing = windows.find(w => w.tabs?.some(t => t.url?.includes('index.html')));
        if (existing?.id) {
            popupWindowId = existing.id;
            if (chrome.storage?.session) {
                await chrome.storage.session.set({ [STORAGE_POPUP_WINDOW_ID]: existing.id });
            }
            await chrome.windows.update(existing.id, { focused: true });
            return;
        }

        // Attempt native action popup first (may fail without user gesture)
        if (chrome.action?.openPopup) {
            try {
                await chrome.action.openPopup();
                return;
            } catch (e) {
            }
        }

        // Fallback: create a dedicated popup window
        const created = await chrome.windows.create({
            url: chrome.runtime.getURL('index.html'),
            type: 'popup',
            width: 360,
            height: 600
        });
        if (created?.id) {
            popupWindowId = created.id;
            if (chrome.storage?.session) {
                await chrome.storage.session.set({ [STORAGE_POPUP_WINDOW_ID]: created.id });
            }
        }
    } catch (e) {
        console.error('[Lumen] Failed to open popup:', e);
    } finally {
        // Release lock after short delay to ensure window is registered
        setTimeout(() => {
            isPopupOpening = false;
        }, 1000);
    }
}

if (typeof chrome !== 'undefined' && chrome.windows?.onRemoved) {
    chrome.windows.onRemoved.addListener((windowId) => {
        if (popupWindowId && windowId === popupWindowId) {
            popupWindowId = null;
            chrome.storage.session.remove(STORAGE_POPUP_WINDOW_ID).catch(() => {
            });
        }
    });
}

function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function handleEnable(origin: string, _tab: any) {

    try {
        // Check state
        const isLocked = await checkWalletLocked();
        const connectedOrigins = await getConnectedOrigins();
        const isConnected = connectedOrigins.includes(origin);

        // If UNLOCKED and CONNECTED, return address immediately
        if (!isLocked && isConnected) {
            await ensureHostPermissions();
            const address = await getWalletAddress();
            if (!address) {
                throw new Error('No wallet found');
            }
            return { data: [address] };
        }

        // Need user interaction (unlock OR approval OR both)
        // Show badge notification instead of opening popup
        await prunePendingQueue();
        const requestId = generateRequestId();

        // Store pending request
        const requestData: PendingRequestData = {
            requestId,
            origin,
            permissions: ['View wallet address', 'Request transaction signatures'],
            type: isLocked ? 'pending-unlock-request' : 'approval-request',
            timestamp: Date.now()
        };

        await enqueuePendingRequest(requestData);

        await openApprovalPopup(_tab);

        return new Promise((resolve, reject) => {
            pendRequest.set(requestId, { resolve, reject, origin, type: 'enable' });

            // Timeout after 5 minutes
            setTimeout(() => {
                if (pendRequest.has(requestId)) {
                    pendRequest.delete(requestId);
                    removePendingRequest(requestId).catch(() => {
                    });
                    reject(new Error('Request timeout'));
                }
            }, REQUEST_TIMEOUT_MS);
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
        removePendingRequest(requestId).catch(() => {
        });
        return;
    }

    pendRequest.delete(requestId);

    removePendingRequest(requestId).catch(() => {
    });

    if (approved) {
        (async () => {
            try {
                if (pending.type === 'enable') {
                    await ensureSitePermission(pending.origin);
                    await ensureHostPermissions();
                }
                await addConnectedOrigin(pending.origin);
                const address = await getWalletAddress();
                if (!address) {
                    throw new Error('No wallet found');
                }
                pending.resolve({ data: [address] });
            } catch (error) {
                await removeConnectedOrigin(pending.origin);
                pending.reject(error);
            }
        })().catch((error) => pending.reject(error));
    } else {
        pending.reject(new Error('User rejected the request'));
    }
}

if (chrome.permissions?.onRemoved) {
    chrome.permissions.onRemoved.addListener(({ origins }) => {
        if (!origins || origins.length === 0) return;
        origins.forEach((originPattern) => {
            const origin = originPattern.replace(/\/\*$/, '');
            removeConnectedOrigin(origin).catch(() => {
            });
        });
    });
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

async function ensureHostPermissions(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.permissions) return;

    const perms = { origins: REQUIRED_HOST_PERMISSIONS };
    const granted = await chrome.permissions.contains(perms);
    if (!granted) {
        throw new Error('Host permissions not granted.');
    }
}

// Pending queue pruning is handled in enqueuePendingRequest / prunePendingQueue

async function getWalletAddress(): Promise<string | null> {
    try {
        // Get wallets from vault (requires active session)
        const wallets = await VaultManager.getWallets();

        if (!wallets || wallets.length === 0) {
            return null;
        }

        const activeAddress = await getActiveWalletAddress();
        if (activeAddress) {
            const match = wallets.find(w => w.address === activeAddress);
            if (match) return match.address;
        }

        // Fallback to first wallet
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
    const result = await chrome.storage.local.get([STORAGE_CONNECTED_ORIGINS]) as { connectedOrigins?: string[] };
    return result.connectedOrigins || [];
}

async function addConnectedOrigin(origin: string): Promise<void> {
    const origins = await getConnectedOrigins();
    if (!origins.includes(origin)) {
        origins.push(origin);
        await chrome.storage.local.set({ [STORAGE_CONNECTED_ORIGINS]: origins });
    }
}

async function removeConnectedOrigin(origin: string): Promise<void> {
    const origins = await getConnectedOrigins();
    const next = origins.filter((o) => o !== origin);
    if (next.length !== origins.length) {
        await chrome.storage.local.set({ [STORAGE_CONNECTED_ORIGINS]: next });
    }
}

// openSidePanel function removed - now using badge notification


async function handleGetAccounts(origin: string) {
    // Check if origin is connected
    const connectedOrigins = await getConnectedOrigins();

    if (!connectedOrigins.includes(origin)) {
        // Not connected, return empty array
        return {
            data: []
        };
    }

    // Connected, return wallet address
    const address = await getWalletAddress();

    return {
        data: address ? [address] : []
    };
}

async function handleGetChainId() {
    // Return Lumen chain ID
    return {
        data: 'lumen' // Lumen chain ID
    };
}

async function handleSendTransaction(params: any, origin: string, _tab: any) {

    await prunePendingQueue();
    const requestId = generateRequestId();

    // Store pending request
    const requestData: PendingRequestData = {
        requestId,
        origin,
        permissions: ['Request transaction signatures'],
        type: 'transaction-request',
        params,
        timestamp: Date.now()
    };

    await enqueuePendingRequest(requestData);
    chrome.runtime.sendMessage({ type: 'show-approval' }).catch(() => {
    });

    await openApprovalPopup(_tab);

    // Wait for user approval
    await new Promise((resolve, reject) => {
        pendRequest.set(requestId, { resolve, reject, origin, type: 'transaction' });

        setTimeout(() => {
            if (pendRequest.has(requestId)) {
                pendRequest.delete(requestId);
                removePendingRequest(requestId).catch(() => {
                });
                reject(new Error('Request timeout'));
            }
        }, REQUEST_TIMEOUT_MS);
    });

    // Handle Generic/EVM Transaction Signing (Placeholder)
    return { error: 'Signing implementation pending for generic transactions' };
}

async function handleSignMessage(params: any, _origin: string, _tab: any) {
    void params;
    void _origin;
    void _tab;
    // TODO: Open popup for user to review and sign message
    // TODO: Sign with private key
    // TODO: Return signature

    throw new Error('Message signing not yet implemented');
}

async function handleSignTypedData(params: any, _origin: string, _tab: any) {
    void params;
    void _origin;
    void _tab;
    // TODO: Parse and validate EIP-712 typed data
    // TODO: Open popup for user to review
    // TODO: Sign and return signature

    throw new Error('Typed data signing not yet implemented');
}

async function handleAddChain(params: any, _origin: string, _tab: any) {
    void params;
    void _origin;
    void _tab;
    // TODO: Validate chain parameters
    // TODO: Prompt user to add chain
    // TODO: Save to storage if approved

    return { data: null };
}

async function handleSwitchChain(params: any, _origin: string, _tab: any) {
    void params;
    void _origin;
    void _tab;
    // TODO: Check if chain exists
    // TODO: Switch active chain
    // TODO: Emit chainChanged event

    throw new Error('Chain switching not yet implemented');
}

// Cosmos-specific handlers for Lumen chain
async function handleCosmosGetKey(chainId: string, origin?: string) {
    if (chainId && chainId !== CHAIN_ID) {
        throw new Error('Unsupported chain');
    }

    if (origin) {
        const connectedOrigins = await getConnectedOrigins();
        if (!connectedOrigins.includes(origin)) {
            throw new Error('Not connected. Call enable() first.');
        }
    }

    const wallets = await VaultManager.getWallets();
    if (!wallets || wallets.length === 0) {
        throw new Error('Wallet is locked or empty');
    }

    try {
        const activeAddress = await getActiveWalletAddress();
        const walletData = activeAddress
            ? wallets.find(w => w.address === activeAddress) || wallets[0]
            : wallets[0];
        const wallet = await Secp256k1HdWallet.fromMnemonic(walletData.mnemonic, { prefix: 'lmn' });
        const accounts = await wallet.getAccounts();
        const account = accounts[0];

        // Decode bech32 address to bytes for dApp compatibility
        const addressBytes = fromBech32(account.address).data;

        return {
            data: {
                name: 'Lumen Wallet',
                algo: account.algo,
                pubKey: account.pubkey,
                address: addressBytes,
                bech32Address: account.address,
                isNanoLedger: false
            }
        };
    } catch (error: any) {
        console.error('[Lumen] getKey error:', error);
        throw new Error(error.message || 'Failed to retrieve key');
    }
}

async function handleCosmosSignAmino(params: any, origin: string, _tab: any) {

    await prunePendingQueue();
    const requestId = generateRequestId();

    const requestData: PendingRequestData = {
        requestId,
        origin,
        permissions: ['Request transaction signatures'],
        type: 'transaction-request',
        params: { ...params, mode: 'amino' },
        timestamp: Date.now()
    };

    await enqueuePendingRequest(requestData);
    chrome.runtime.sendMessage({ type: 'show-approval' }).catch(() => {
    });

    await openApprovalPopup(_tab);

    // Wait for user approval
    await new Promise((resolve, reject) => {
        pendRequest.set(requestId, { resolve, reject, origin, type: 'transaction' });

        setTimeout(() => {
            if (pendRequest.has(requestId)) {
                pendRequest.delete(requestId);
                removePendingRequest(requestId).catch(() => {
                });
                reject(new Error('Request timeout'));
            }
        }, REQUEST_TIMEOUT_MS);
    });

    // User approved, sign logic
    try {
        const wallets = await VaultManager.getWallets();
        const signerAddress = params?.signerAddress;
        const signDoc = params?.signDoc;

        if (!signerAddress || !signDoc) {
            throw new Error('Missing signerAddress or signDoc');
        }

        // Find wallet
        const walletData = wallets.find(w => w.address === signerAddress);
        if (!walletData) throw new Error('Signer address not found in wallet');

        const wallet = await Secp256k1HdWallet.fromMnemonic(walletData.mnemonic, { prefix: 'lmn' });
        const result = await wallet.signAmino(signerAddress, signDoc);

        const [account] = await wallet.getAccounts();
        if (account.address !== signerAddress) {
            throw new Error('Signer address mismatch');
        }

        const { pqcPrivKey, pqcPubKey } = getPqcKeys(walletData);

        const chainId = signDoc.chain_id || signDoc.chainId || CHAIN_ID;
        const accountNumber = toNumber(signDoc.account_number ?? signDoc.accountNumber, 'account_number');

        const signedDoc = result?.signed || signDoc;
        const fee = signedDoc.fee;
        if (!fee) throw new Error('Missing fee in signDoc');

        const gasLimit = toNumber(fee.gas, 'fee.gas');
        const sequence = toNumber(signedDoc.sequence ?? signDoc.sequence, 'sequence');

        const memo = signedDoc.memo ?? signDoc.memo ?? '';
        const timeoutHeightRaw =
            signedDoc.timeout_height ??
            (signedDoc as any).timeoutHeight ??
            signDoc.timeout_height ??
            (signDoc as any).timeoutHeight;
        const timeoutHeight = timeoutHeightRaw !== undefined ? toNumber(timeoutHeightRaw, 'timeout_height') : undefined;

        const aminoMsgs = signedDoc.msgs ?? signDoc.msgs ?? [];
        const protoMsgs = aminoMsgs.map((msg: any) => defaultAminoTypes.fromAmino(msg));

        const txBodyValue: any = {
            messages: protoMsgs,
            memo: memo
        };
        if (timeoutHeight !== undefined && timeoutHeight !== 0) {
            txBodyValue.timeoutHeight = timeoutHeight;
        }

        const txBodyBytes = defaultRegistry.encode({
            typeUrl: '/cosmos.tx.v1beta1.TxBody',
            value: txBodyValue
        });

        const pubkey = encodePubkey(getAminoPubkey(account));
        const authInfoBytes = makeAuthInfoBytes(
            [{ pubkey, sequence }],
            fee.amount,
            gasLimit,
            fee.granter,
            fee.payer,
            SignMode.SIGN_MODE_LEGACY_AMINO_JSON
        );

        const tempTxRaw = {
            bodyBytes: txBodyBytes,
            authInfoBytes: authInfoBytes,
            signatures: []
        };

        // @ts-ignore
        const pqcPayload = LumenSDK.pqc.computeSignBytes(chainId, accountNumber, tempTxRaw);
        // @ts-ignore
        const pqcSigRaw = await LumenSDK.pqc.signDilithium(pqcPayload, pqcPrivKey);

        const pqcEntry = {
            addr: walletData.address,
            scheme: 'dilithium3',
            signature: new Uint8Array(pqcSigRaw),
            pubKey: pqcPubKey
        };

        // @ts-ignore
        const finalTxBodyBytes = LumenSDK.pqc.withPqcExtension(txBodyBytes, [pqcEntry]);

        const pqcTxRaw = TxRaw.fromPartial({
            bodyBytes: finalTxBodyBytes,
            authInfoBytes: authInfoBytes,
            signatures: [fromBase64(result.signature.signature)]
        });
        const pqcTxRawBytes = TxRaw.encode(pqcTxRaw).finish();

        return {
            data: {
                ...result,
                pqc: {
                    bodyBytes: finalTxBodyBytes,
                    authInfoBytes: authInfoBytes,
                    txRawBytes: pqcTxRawBytes
                }
            }
        };
    } catch (error: any) {
        console.error('SignAmino failed:', error);
        throw new Error(error.message || 'Signing failed');
    }
}

async function handleCosmosSignDirect(params: any, origin: string, _tab: any) {

    await prunePendingQueue();
    const requestId = generateRequestId();

    const requestData: PendingRequestData = {
        requestId,
        origin,
        permissions: ['Request transaction signatures'],
        type: 'transaction-request',
        params: { ...params, mode: 'direct' },
        timestamp: Date.now()
    };

    await enqueuePendingRequest(requestData);

    await openApprovalPopup(_tab);

    // Wait for user approval
    await new Promise((resolve, reject) => {
        pendRequest.set(requestId, { resolve, reject, origin, type: 'transaction' });

        setTimeout(() => {
            if (pendRequest.has(requestId)) {
                pendRequest.delete(requestId);
                removePendingRequest(requestId).catch(() => {
                });
                reject(new Error('Request timeout'));
            }
        }, REQUEST_TIMEOUT_MS);
    });

    // User approved, sign logic
    try {
        const wallets = await VaultManager.getWallets();
        const signerAddress = params?.signerAddress;
        const signDoc = params?.signDoc;

        if (!signerAddress || !signDoc) {
            throw new Error('Missing signerAddress or signDoc');
        }

        // Find wallet
        const walletData = wallets.find(w => w.address === signerAddress);
        if (!walletData) throw new Error('Signer address not found in wallet');

        // Create signer
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(walletData.mnemonic, { prefix: 'lmn' });

        const { pqcPrivKey, pqcPubKey } = getPqcKeys(walletData);

        const chainId = signDoc.chainId || CHAIN_ID;
        const accountNumber = toNumber(signDoc.accountNumber, 'accountNumber');

        const bodyBytes = ensureUint8Array(signDoc.bodyBytes);
        const authInfoBytes = ensureUint8Array(signDoc.authInfoBytes);

        const tempTxRaw = {
            bodyBytes: bodyBytes,
            authInfoBytes: authInfoBytes,
            signatures: []
        };

        // @ts-ignore
        const pqcPayload = LumenSDK.pqc.computeSignBytes(chainId, accountNumber, tempTxRaw);
        // @ts-ignore
        const pqcSigRaw = await LumenSDK.pqc.signDilithium(pqcPayload, pqcPrivKey);

        const pqcEntry = {
            addr: walletData.address,
            scheme: 'dilithium3',
            signature: new Uint8Array(pqcSigRaw),
            pubKey: pqcPubKey
        };

        // @ts-ignore
        const finalTxBodyBytes = LumenSDK.pqc.withPqcExtension(bodyBytes, [pqcEntry]);

        const signDocWithPqc = {
            ...signDoc,
            bodyBytes: finalTxBodyBytes,
            authInfoBytes: authInfoBytes,
            chainId: chainId
        };

        // Sign
        const result = await wallet.signDirect(signerAddress, signDocWithPqc);
        const signedBodyBytes = result?.signed?.bodyBytes;
        const signedAuthInfoBytes = result?.signed?.authInfoBytes;
        const normalizedResult = {
            ...result,
            signed: {
                ...result.signed,
                bodyBytes: signedBodyBytes ? Buffer.from(signedBodyBytes).toString('base64') : '',
                authInfoBytes: signedAuthInfoBytes ? Buffer.from(signedAuthInfoBytes).toString('base64') : ''
            }
        };

        return { data: normalizedResult };
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
}
*/
