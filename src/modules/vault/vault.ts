import scriptAES from 'crypto-js/aes';
import scriptENC from 'crypto-js/enc-utf8';
import type { LumenWallet } from '../sdk/key-manager';

const STORAGE_KEY_VAULT = 'lumen_vault_v1';
const STORAGE_KEY_SESSION = 'lumen_session_v1';
const STORAGE_KEY_SETTINGS = 'lumen_settings_v1';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; /* 5 Minutes */

const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_HASH = 'SHA-256';
const AES_GCM_IV_BYTES = 12;
const SALT_BYTES = 16;

interface EncryptedVaultV2 {
    v: 2;
    kdf: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    saltB64: string;
    ivB64: string;
    ciphertextB64: string;
}

interface EncryptedVaultV1 {
    data: string;
    salt?: string;
}

interface VaultSettings {
    lockTimeoutMsg: number;
    lockType: 'minute' | 'hour' | 'day';
    lockValue: number;
}

interface SessionData {
    lastActiveAt: number;
}

const hasChromeStorageLocal = () =>
    typeof chrome !== 'undefined' && !!chrome.storage?.local;

const hasChromeStorageSession = () =>
    typeof chrome !== 'undefined' && !!chrome.storage?.session;

const storageLocal = {
    get: async (key: string): Promise<any> => {
        if (hasChromeStorageLocal()) {
            const result = await chrome.storage.local.get(key);
            return result[key] ? JSON.parse(result[key] as string) : null;
        }
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : null;
    },
    set: async (key: string, value: any): Promise<void> => {
        const valStr = JSON.stringify(value);
        if (hasChromeStorageLocal()) {
            await chrome.storage.local.set({ [key]: valStr });
        } else {
            localStorage.setItem(key, valStr);
        }
    },
    remove: async (key: string): Promise<void> => {
        if (hasChromeStorageLocal()) {
            await chrome.storage.local.remove(key);
        } else {
            localStorage.removeItem(key);
        }
    }
};

const storageSession = {
    get: async (key: string): Promise<any> => {
        if (hasChromeStorageSession()) {
            const result = await chrome.storage.session.get(key);
            return result[key] ? JSON.parse(result[key] as string) : null;
        }
        const val = sessionStorage.getItem(key);
        return val ? JSON.parse(val) : null;
    },
    set: async (key: string, value: any): Promise<void> => {
        const valStr = JSON.stringify(value);
        if (hasChromeStorageSession()) {
            await chrome.storage.session.set({ [key]: valStr });
        } else {
            sessionStorage.setItem(key, valStr);
        }
    },
    remove: async (key: string): Promise<void> => {
        if (hasChromeStorageSession()) {
            await chrome.storage.session.remove(key);
        } else {
            sessionStorage.removeItem(key);
        }
    }
};

const bytesToB64 = (bytes: Uint8Array): string => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
};

const b64ToBytes = (b64: string): Uint8Array => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

const getCrypto = (): Crypto => {
    // Extension pages have `crypto` available; in dev fallback this still exists in modern browsers.
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        throw new Error('WebCrypto is not available in this environment.');
    }
    return crypto;
};

const deriveAesKeyFromPassword = async (password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> => {
    const cryptoImpl = getCrypto();
    const enc = new TextEncoder();
    const saltBytes = new Uint8Array(salt);
    const baseKey = await cryptoImpl.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return await cryptoImpl.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations,
            hash: PBKDF2_HASH,
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

let cachedVaultKey: CryptoKey | null = null;

export class VaultManager {
    /**
     * Encrypts and stores the wallet data in the vault.
     * Also refreshes the session.
     * @param wallets - List of wallets to store
     * @param password - Encryption password
     */
    static async lock(wallets: LumenWallet[], password?: string): Promise<void> {
        if (!cachedVaultKey && !password) {
            throw new Error('Wallet is locked.');
        }

        const cryptoImpl = getCrypto();
        const iv = new Uint8Array(cryptoImpl.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES)));

        let salt: Uint8Array;
        let iterations: number;
        let key: CryptoKey;

        if (cachedVaultKey) {
            // Reuse the existing derived key and KDF params. Rotate IV only.
            const existing = await storageLocal.get(STORAGE_KEY_VAULT) as EncryptedVaultV2 | null;
            if (!existing || existing.v !== 2) {
                throw new Error('Vault metadata missing or unsupported.');
            }
            salt = new Uint8Array(b64ToBytes(existing.saltB64));
            iterations = existing.iterations || PBKDF2_ITERATIONS;
            key = cachedVaultKey;
        } else {
            salt = new Uint8Array(cryptoImpl.getRandomValues(new Uint8Array(SALT_BYTES)));
            iterations = PBKDF2_ITERATIONS;
            key = await deriveAesKeyFromPassword(password!, salt, iterations);
            cachedVaultKey = key;
        }

        const plaintext = new TextEncoder().encode(JSON.stringify(wallets));
        const ciphertext = new Uint8Array(await cryptoImpl.subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, plaintext));

        const vault: EncryptedVaultV2 = {
            v: 2,
            kdf: 'PBKDF2',
            hash: 'SHA-256',
            iterations,
            saltB64: bytesToB64(salt),
            ivB64: bytesToB64(iv),
            ciphertextB64: bytesToB64(ciphertext),
        };

        await storageLocal.set(STORAGE_KEY_VAULT, vault);
        await this.touchSession();
    }

    /**
     * Decrypts the vault and retrieves the wallet list.
     * @param password - Decryption password
     * @returns List of LumenWallets
     */
    static async unlock(password: string): Promise<LumenWallet[]> {
        const rawVault = await storageLocal.get(STORAGE_KEY_VAULT) as EncryptedVaultV2 | EncryptedVaultV1 | null;
        if (!rawVault) throw new Error("No wallet found.");

        // Legacy vault (CryptoJS AES passphrase) migration path.
        if ((rawVault as any).v !== 2 && typeof (rawVault as any).data === 'string') {
            try {
                const bytes = scriptAES.decrypt((rawVault as EncryptedVaultV1).data, password);
                const decryptedStr = bytes.toString(scriptENC);
                if (!decryptedStr) throw new Error("Decryption failed. Invalid password.");

                const parsed = JSON.parse(decryptedStr);
                const wallets = Array.isArray(parsed) ? parsed as LumenWallet[] : [parsed as LumenWallet];

                // Re-encrypt into V2 format (AES-GCM + PBKDF2) without storing the password.
                await this.lock(wallets, password);
                return wallets;
            } catch {
                throw new Error("Incorrect Password.");
            }
        }

        const vault = rawVault as EncryptedVaultV2;
        if (vault.v !== 2) throw new Error("Unsupported vault format.");

        try {
            const cryptoImpl = getCrypto();
            const salt = new Uint8Array(b64ToBytes(vault.saltB64));
            const iv = new Uint8Array(b64ToBytes(vault.ivB64));
            const ciphertext = new Uint8Array(b64ToBytes(vault.ciphertextB64));

            const key = await deriveAesKeyFromPassword(password, salt, vault.iterations || PBKDF2_ITERATIONS);
            const plaintextBuf = await cryptoImpl.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, ciphertext);
            const decryptedStr = new TextDecoder().decode(new Uint8Array(plaintextBuf));

            const parsed = JSON.parse(decryptedStr);
            const wallets = Array.isArray(parsed) ? parsed as LumenWallet[] : [parsed as LumenWallet];

            cachedVaultKey = key;
            await this.touchSession();
            return wallets;
        } catch (e) {
            throw new Error("Incorrect Password.");
        }
    }

    /**
     * Returns the decrypted wallets using the in-memory session key.
     */
    static async getWallets(): Promise<LumenWallet[]> {
        if (!cachedVaultKey) {
            throw new Error('Session expired.');
        }

        const vault = await storageLocal.get(STORAGE_KEY_VAULT) as EncryptedVaultV2 | null;
        if (!vault) throw new Error("No wallet found.");
        if (vault.v !== 2) throw new Error("Unsupported vault format.");

        const cryptoImpl = getCrypto();
        const iv = new Uint8Array(b64ToBytes(vault.ivB64));
        const ciphertext = new Uint8Array(b64ToBytes(vault.ciphertextB64));
        const plaintextBuf = await cryptoImpl.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, cachedVaultKey, ciphertext);
        const decryptedStr = new TextDecoder().decode(new Uint8Array(plaintextBuf));
        const parsed = JSON.parse(decryptedStr);
        return Array.isArray(parsed) ? parsed as LumenWallet[] : [parsed as LumenWallet];
    }

    static async saveWallets(wallets: LumenWallet[]): Promise<void> {
        await this.lock(wallets);
    }

    /**
     * Updates the auto-lock timeout settings.
     * @param type - Time unit (minute, hour, day)
     * @param value - Amount (e.g. 5)
     */
    static async setLockTimeout(type: 'minute' | 'hour' | 'day', value: number) {
        let ms = DEFAULT_TIMEOUT_MS;
        if (type === 'minute') ms = value * 60 * 1000;
        if (type === 'hour') ms = value * 60 * 60 * 1000;
        if (type === 'day') ms = value * 24 * 60 * 60 * 1000;

        const settings: VaultSettings = {
            lockTimeoutMsg: ms,
            lockType: type,
            lockValue: value
        };
        await storageLocal.set(STORAGE_KEY_SETTINGS, settings);
    }

    /**
     * Gets the current lock settings.
     */
    static async getLockSettings(): Promise<{ type: 'minute' | 'hour' | 'day', value: number }> {
        const s = await storageLocal.get(STORAGE_KEY_SETTINGS) as VaultSettings | null;
        if (s) {
            return { type: s.lockType || 'minute', value: s.lockValue || 5 };
        }
        return { type: 'minute', value: 5 };
    }

    private static async getLockTimeout(): Promise<number> {
        const s = await storageLocal.get(STORAGE_KEY_SETTINGS) as VaultSettings | null;
        return s?.lockTimeoutMsg || DEFAULT_TIMEOUT_MS;
    }

    /**
     * Checks if a vault exists in storage.
     */
    static async hasWallet(): Promise<boolean> {
        const v = await storageLocal.get(STORAGE_KEY_VAULT);
        return !!v;
    }

    /**
     * Wipes the vault and all settings/session data.
     */
    static async clear(): Promise<void> {
        await storageLocal.remove(STORAGE_KEY_VAULT);
        await this.clearSession();
        await storageLocal.remove(STORAGE_KEY_SETTINGS);
    }

    static async isSessionExpired(): Promise<boolean> {
        const existing = await storageSession.get(STORAGE_KEY_SESSION) as SessionData | null;
        if (!existing) return true;

        const timeout = await this.getLockTimeout();
        return Date.now() - existing.lastActiveAt > timeout;
    }

    static async touchSession() {
        const session = await storageSession.get(STORAGE_KEY_SESSION) as SessionData | null;
        if (session) {
            session.lastActiveAt = Date.now();
            await storageSession.set(STORAGE_KEY_SESSION, session);
        } else {
            await storageSession.set(STORAGE_KEY_SESSION, { lastActiveAt: Date.now() } satisfies SessionData);
        }
    }

    static async clearSession() {
        cachedVaultKey = null;
        await storageSession.remove(STORAGE_KEY_SESSION);
    }

    /**
     * Removes a specific wallet from the vault.
     * @param address - Wallet address to remove
     */
    static async removeWallet(address: string): Promise<LumenWallet[]> {
        const wallets = await this.getWallets();
        const filtered = wallets.filter(w => w.address !== address);

        if (filtered.length === 0) {
            await this.clear();
            return [];
        }

        await this.saveWallets(filtered);
        return filtered;
    }
}
