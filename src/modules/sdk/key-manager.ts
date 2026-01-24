import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import * as LumenSDK from '@lumen-chain/sdk';
import { Buffer } from 'buffer';
import type { LumenWallet, PqcKeyData } from '../../types/wallet';

export type { LumenWallet, PqcKeyData };

export class KeyManager {
    /**
     * Generates a new dual-stack wallet.
     * Creates HD Wallet (Secp256k1) and PQC KeyPair (Dilithium3).
     */
    static async createWallet(): Promise<LumenWallet> {
        /* 1. Standard Wallet */
        const wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: 'lmn' });
        const accounts = await wallet.getAccounts();

        /* 2. PQC Generation */
        // @ts-ignore
        const pqcKeys = await LumenSDK.pqc.createKeyPair('dilithium3');

        /* 3. Validation & Hex Conversion */
        const pubBuf = Buffer.from(pqcKeys.publicKey);
        const privBuf = Buffer.from(pqcKeys.privateKey);

        if (privBuf.length !== 4000) throw new Error("Invalid PQC Private Key Length");
        if (pubBuf.length !== 1952) throw new Error("Invalid PQC Public Key Length");

        /* 4. Construct Strict Object */
        const pqcKey: PqcKeyData = {
            scheme: 'dilithium3',
            publicKey: pubBuf.toString('hex'),  /* Store as HEX */
            privateKey: privBuf.toString('hex'), /* Store as HEX */
            createdAt: new Date().toISOString()
        };

        return {
            mnemonic: wallet.mnemonic,
            address: accounts[0].address,
            pqcKey: pqcKey /* Matches interface */
        };
    }

    /**
     * Imports a wallet.
     * Supports:
     * 1. Mnemonic + Raw Key Data (Validator style or UI form)
     * 2. Full Backup JSON (Extension export style)
     */
    static async importWallet(input: string | any, pqcExtra?: any): Promise<LumenWallet> {
        let mnemonic: string | undefined;
        let rawPqcData: any;
        let address: string | undefined;

        /* Case A: Mnemonic + Raw PQC (Validator Import / Manual) */
        /* Check if input is a mnemonic (space separated words) */
        const isMnemonic = typeof input === 'string' && input.split(' ').length >= 12; /* Simple heuristic */

        if (isMnemonic) {
            mnemonic = input;
            rawPqcData = pqcExtra;

            /* Re-derive standard address */
            const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'lmn' });
            const accounts = await wallet.getAccounts();
            address = accounts[0].address;

        } else {
            /* Case B: Full Backup JSON */
            let data: any;
            if (typeof input === 'string') {
                try {
                    data = JSON.parse(input);
                } catch (e) {
                    throw new Error("Invalid Wallet JSON string");
                }
            } else {
                data = input;
            }

            if (!data.mnemonic || !data.address) {
                throw new Error("Invalid Wallet Backup: Missing mnemonic or address");
            }

            mnemonic = data.mnemonic;
            address = data.address;
            rawPqcData = data; /* The backup object itself contains the keys */
        }

        if (!rawPqcData) {
            throw new Error("Missing PQC Key Data for import");
        }

        /* Normalize (The Fix for Validators + Extension Compatibility) */
        const standardizedKey = this.normalizePqcInput(rawPqcData);

        return {
            type: "lumen/dual-signer",
            version: 1,
            mnemonic: mnemonic!,
            address: address!,
            pqcKey: standardizedKey
        };
    }

    /**
     * Smart Adapter: Handles Snake_Case (Validator) vs CamelCase (Extension)
     * and Base64 vs Hex.
     */
    private static normalizePqcInput(input: any): PqcKeyData {
        /* 1. Smart Detection: Find the PQC Object */
        /* It could be under "validator-pqc", "pqc", "pqcKey", or at the root. */
        const source = input['validator-pqc'] || input['pqc'] || input['pqcKey'] || input;

        if (!source) throw new Error("Could not find PQC data in file");

        /* 2. Extract Keys (Handle Snake_Case vs CamelCase) */
        const rawPriv = source.private_key || source.privateKey || source.encryptedPrivateKey;
        const rawPub = source.public_key || source.publicKey;

        if (!rawPriv) throw new Error("Missing Private Key (checked private_key/privateKey)");

        /* 3. Normalize to Hex (Handle Base64 vs Hex) */
        const toHex = (str: string): string => {
            if (!str) return "";
            const cleanStr = str.trim();
            /* Regex: If it contains non-hex chars, assume Base64 */
            /* Note: Base64 can have +, /, =. Hex is 0-9a-f. */
            if (/^[0-9a-fA-F]+$/.test(cleanStr)) {
                return cleanStr; /* Already Hex */
            }
            return Buffer.from(cleanStr, 'base64').toString('hex');
        };

        const privHex = toHex(rawPriv);
        let pubHex = toHex(rawPub);

        /* 4. Pubkey Recovery (Dilithium Feature) */
        /* If public key is missing, extract from private key (first 1952 bytes) */
        if ((!pubHex || pubHex.length === 0) && privHex.length === 8000) {
            /* Warn: Recovering Public Key from Private Key... */
            pubHex = privHex.substring(0, 3904);
        }

        /* 5. Validate */
        if (privHex.length !== 8000) throw new Error(`Invalid Private Key Length: ${privHex.length} (Expected 8000 hex chars)`);
        if (pubHex.length !== 3904) throw new Error(`Invalid Public Key Length: ${pubHex.length} (Expected 3904 hex chars)`);

        /* 6. Return Internal Format (CamelCase for App Consistency) */
        return {
            scheme: 'dilithium3',
            privateKey: privHex,  /* Stored internally as camelCase */
            publicKey: pubHex,    /* Stored internally as camelCase */
            createdAt: source.created_at || source.createdAt || new Date().toISOString()
        };
    }

    /**
     * Recover wallet from Mnemonic ONLY (Generates NEW PQC Key)
     */
    static async recoverFromMnemonic(mnemonic: string): Promise<LumenWallet> {
        /* Re-derive standard address */
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'lmn' });
        const accounts = await wallet.getAccounts();

        /* Generate NEW PQC Key */
        // @ts-ignore
        const pqcKeys = await LumenSDK.pqc.createKeyPair('dilithium3');

        const pubBuf = Buffer.from(pqcKeys.publicKey);
        const privBuf = Buffer.from(pqcKeys.privateKey);

        const pqcKey: PqcKeyData = {
            scheme: 'dilithium3',
            publicKey: pubBuf.toString('hex'),
            privateKey: privBuf.toString('hex'),
            createdAt: new Date().toISOString()
        };

        return {
            type: "lumen/dual-signer",
            version: 1,
            mnemonic: mnemonic,
            address: accounts[0].address,
            pqcKey: pqcKey
        };
    }

    /**
     * Helper to derive an address from a mnemonic
     */
    static async deriveAddress(mnemonic: string): Promise<string> {
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'lmn' });
        const accounts = await wallet.getAccounts();
        return accounts[0].address;
    }
}
