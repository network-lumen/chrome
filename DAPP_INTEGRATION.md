# Lumen Wallet Integration Guide

This document provides technical details on how to integrate Decentralized Applications (dApps) with the Lumen Wallet Chrome Extension.

## 1. Provider Detection

Lumen Wallet injects a global API into the `window` object of every visited website. dApps should check for the existence of `window.lumen`.

```javascript
if (window.lumen) {
    console.log('Lumen Wallet is installed!');
} else {
    console.log('Lumen Wallet not found. Please install securely.');
}
```

### Type Definition (TypeScript)
For TypeScript projects, you can extend the Window interface:

```typescript
interface LumenProvider {
    request: (args: { method: string; params?: any }) => Promise<any>;
    on: (eventName: string, callback: (data: any) => void) => void;
    removeListener: (eventName: string, callback: (data: any) => void) => void;
    isLumen: boolean;
    enable: () => Promise<string[]>;
}

declare global {
    interface Window {
        lumen?: LumenProvider;
    }
}
```

## 2. Connecting to the Wallet

To request access to the user's wallet (and prompt them to unlock/approve), use the `eth_requestAccounts` method. This follows the EIP-1193 standard.

**Method:** `eth_requestAccounts`

```javascript
try {
    const accounts = await window.lumen.request({ 
        method: 'eth_requestAccounts' 
    });
    
    const userAddress = accounts[0];
    console.log('Connected:', userAddress);
} catch (error) {
    if (error.code === 4001) {
        // User rejected request
        console.error('User denied connection');
    } else {
        console.error('Connection failed', error);
    }
}
```

*Note: You can also use the legacy `window.lumen.enable()` method, which behaves identically.*

## 3. Getting Current Account & Session

Once connected, you can check the currently active account without prompting a popup (provided the wallet is unlocked and the site is already approved).

**Method:** `eth_accounts`

```javascript
const accounts = await window.lumen.request({ 
    method: 'eth_accounts' 
});

if (accounts.length > 0) {
    console.log('Active session for:', accounts[0]);
} else {
    console.log('No active session. Please call eth_requestAccounts first.');
}
```

### Session Maintenance
Lumen Wallet handles session management automatically:
*   **Auto-Lock**: The wallet locks itself after a period of inactivity (default 5 mins), clearing the session from memory.
*   **Re-Connection**: If the wallet is locked, calls to `eth_requestAccounts` will prompt the user to unlock the wallet first. If the site was previously approved, no new approval dialog is shown—it simply unlocks and returns the address.
*   **Persisted Permissions**: Site approvals are stored permanently until manually disconnected by the user in Settings.

## 4. Signing Transactions (Cosmos)

Lumen Wallet supports standard Cosmos signing flow.

### Direct Signing (Protobuf)
Used for standard Cosmos SDK transactions.

**Method:** `cosmos_signDirect`

```javascript
/* Standard Cosmos SignDoc */
const signDoc = {
    bodyBytes: "...", // Uint8Array or Hex
    authInfoBytes: "...", 
    chainId: "lumen-1",
    accountNumber: "1",
};

try {
    const result = await window.lumen.request({
        method: 'cosmos_signDirect',
        params: {
            signerAddress: userAddress,
            signDoc: signDoc
        }
    });
    
    // result contains the signed transaction object ready for broadcast
    console.log('Signed Tx:', result);
} catch (err) {
    console.error('Signing rejected', err);
}
```

### Amino Signing (Legacy/Ledger)
Used for older chains or hardware wallet compatibility.

**Method:** `cosmos_signAmino`

```javascript
const result = await window.lumen.request({
    method: 'cosmos_signAmino',
    params: {
        signerAddress: userAddress,
        signDoc: aminoSignDoc
    }
});
```

## 5. Handling Events

Lumen Wallet supports the EIP-1193 event system to notify dApps of state changes.

```javascript
// Listen for account changes (e.g., user switches wallet or disconnects)
window.lumen.on('accountsChanged', (accounts) => {
    if (accounts.length === 0) {
        console.log('User disconnected');
    } else {
        console.log('Account changed to:', accounts[0]);
    }
});

// Listen for chain/network changes
window.lumen.on('chainChanged', (chainId) => {
    console.log('Network switched to:', chainId);
    window.location.reload(); // Recommended practice
});
```

## Summary of RPC Methods

| Method | Description | Params | Returns |
|--------|-------------|--------|---------|
| `eth_requestAccounts` | Connect & Get Address | None | `Promise<string[]>` |
| `eth_accounts` | Get Address (if connected) | None | `Promise<string[]>` |
| `eth_chainId` | Get current Chain ID | None | `Promise<string>` |
| `cosmos_signDirect` | Sign Protobuf Tx | `{ signerAddress, signDoc }` | `Promise<DirectSignResponse>` |
| `cosmos_signAmino` | Sign Amino Tx | `{ signerAddress, signDoc }` | `Promise<AminoSignResponse>` |

## 6. Custom Wallet Registration (Cosmos Kit / Custom Modals)

Since Lumen Network is not yet in the `chain-registry` and the wallet is not standard, you must manually register both the **Chain** and the **Wallet** in your dApp.

### A. Defining the Chain Locally
You must provide the Chain Information object to your wallet provider.

```typescript
export const lumenChainInfo = {
    chain_id: 'lumen',
    chain_name: 'lumen',
    pretty_name: 'Lumen Network',
    status: 'live',
    network_type: 'mainnet',
    bech32_prefix: 'lmn',
    daemon_name: 'lumend',
    node_home: '$HOME/.lumen',
    key_algos: ['secp256k1'],
    slip44: 118,
    fees: {
        fee_tokens: [{
            denom: 'ulmn',
            fixed_min_gas_price: 0.0025,
            low_gas_price: 0.0025,
            average_gas_price: 0.025,
            high_gas_price: 0.04
        }]
    },
    apis: {
        rpc: [{ address: 'https://rpc.lumen.network', provider: 'Lumen' }],
        rest: [{ address: 'https://api.lumen.network', provider: 'Lumen' }]
    }
};
```

### B. Creating a Custom Wallet Adapter
Most dApps use a "Cosmos Kit" or similar adapter. Since `window.lumen` does not expose `getOfflineSigner` directly on the window object (unlike Keplr), you need to wrap the `window.lumen.request` calls.

**Example: Creating a Lumen Wallet Object for Cosmos Kit**

```typescript
import { MainWalletBase, Wallet } from '@cosmos-kit/core';

export const lumenWalletInfo: Wallet = {
    name: 'lumen-wallet',
    prettyName: 'Lumen Wallet',
    mode: 'extension',
    mobileDisabled: true,
    rejectStyle: {
        source: 'request',
        borderColor: '#f5d996'
    },
    connectEventNamesOnWindow: ['lumen#initialized'],
    downloads: [
        { device: 'desktop', browser: 'chrome', link: 'https://chrome.google.com/webstore/...' }
    ]
};

export class LumenExtensionWallet extends MainWalletBase {
    constructor(walletInfo: Wallet) {
        super(walletInfo, window.lumen);
    }

    async getAccount(chainId: string) {
        const accounts = await window.lumen.request({ method: 'eth_requestAccounts' });
        return {
            address: accounts[0],
            algo: 'secp256k1',
            pubkey: new Uint8Array() // Pubkey retrieval via 'cosmos_getKey' if needed
        };
    }

    async getOfflineSigner(chainId: string) {
        // Return an object that matches OfflineSigner interface
        return {
            getAccounts: async () => {
                const accts = await this.getAccount(chainId);
                return [accts];
            },
            signDirect: async (signerAddress, signDoc) => {
                return window.lumen.request({
                    method: 'cosmos_signDirect',
                    params: { signerAddress, signDoc }
                });
            },
            signAmino: async (signerAddress, signDoc) => {
                return window.lumen.request({
                    method: 'cosmos_signAmino',
                    params: { signerAddress, signDoc }
                });
            }
        };
    }
}
```

### C. Integrating into the Modal
Pass your custom wallet and chain to the provider:

```typescript
<ChainProvider
    chains={[...chains, lumenChainInfo]}
    wallets={[...wallets, new LumenExtensionWallet(lumenWalletInfo)]}
>
    <App />
</ChainProvider>
```

