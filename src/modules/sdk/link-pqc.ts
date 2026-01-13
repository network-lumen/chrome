import { Buffer } from 'buffer';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import * as LumenSDK from '@lumen-chain/sdk';
import { TxRaw, SignDoc, TxBody, AuthInfo, Fee } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { Any } from 'cosmjs-types/google/protobuf/any';
import type { LumenWallet } from '../../types/wallet';

const CHAIN_ID = "lumen";
const DEFAULT_REST = "https://api-lumen.winnode.xyz";

/**
 * Helper: Hex/Base64 Decoder
 * Smartly detects and decodes hex or base64 strings to Uint8Array
 */
const ensureUint8Array = (input: string | Uint8Array | undefined): Uint8Array => {
    if (!input) return new Uint8Array(0);
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.length === 0) return new Uint8Array(0);

        /* Hex Check */
        if (/^[0-9a-fA-F]+$/.test(trimmed)) {
            try {
                const buf = Buffer.from(trimmed, 'hex');
                if (buf.length > 0) return new Uint8Array(buf);
            } catch (e) {
                /* Hex decode failed, ignoring */
            }
        }

        /* Base64 decoding */
        try {
            const buf = Buffer.from(trimmed, 'base64');
            if (buf.length > 0) return new Uint8Array(buf);

            /* Fallback to atob */
            const binString = atob(trimmed);
            return new Uint8Array(binString.split('').map(c => c.charCodeAt(0)));
        } catch (e) {
            /* Base64 decode failed, using raw bytes */
            try {
                const binString = atob(trimmed);
                return new Uint8Array(binString.split('').map(c => c.charCodeAt(0)));
            } catch (err) {
                return new Uint8Array(0);
            }
        }
    }
    return new Uint8Array(input as any);
};

export interface LinkRequirements {
    minBalance: string;  /* in ulmn */
    powDifficultyBits: number;
}

export interface LinkStatus {
    isLinked: boolean;
    pqcPublicKey?: string;
}

/**
 * Fetches chain parameters for PQC account linking
 */
export async function getLinkRequirements(apiEndpoint: string = DEFAULT_REST): Promise<LinkRequirements> {
    try {
        const res = await fetch(`${apiEndpoint}/lumen/pqc/v1/params`);
        if (!res.ok) throw new Error(`Failed to fetch params: ${res.status}`);

        const data = await res.json();
        return {
            minBalance: data.params?.min_balance_for_link?.amount || '1000',
            powDifficultyBits: data.params?.pow_difficulty_bits || 21
        };
    } catch (err: any) {
        console.error('[LINK] Failed to fetch requirements:', err);
        /* Return defaults */
        return { minBalance: '1000', powDifficultyBits: 21 };
    }
}

/**
 * Checks if account has sufficient balance for linking
 */
export async function checkBalance(address: string, minBalance: string, apiEndpoint: string = DEFAULT_REST): Promise<boolean> {
    try {
        const res = await fetch(`${apiEndpoint}/cosmos/bank/v1beta1/balances/${address}`);
        if (!res.ok) return false;

        const data = await res.json();
        const ulmnBalance = data.balances?.find((b: any) => b.denom === 'ulmn');
        const balance = parseInt(ulmnBalance?.amount || '0');
        const required = parseInt(minBalance);

        return balance >= required;
    } catch (err) {
        console.error('[LINK] Balance check failed:', err);
        return false;
    }
}

/**
 * Computes proof-of-work nonce for MsgLinkAccountPQC
 * This may take several seconds depending on difficulty
 */
export async function computeLinkPowNonce(
    pqcPubKey: string, /* Accept hex or base64 */
    difficultyBits: number,
    onProgress?: (hashCount: number) => void
): Promise<string> {
    const pubKeyBytes = ensureUint8Array(pqcPubKey);
    if (pubKeyBytes.length === 0) {
        throw new Error("Invalid PQC public key: decoded to 0 bytes");
    }

    try {
        // @ts-ignore - SDK method for PoW computation
        const nonceBytes = LumenSDK.pqc.computePowNonce(pubKeyBytes, difficultyBits, {
            onProgress: onProgress
        } as any);

        const nonceHex = Buffer.from(nonceBytes).toString('hex');
        return nonceHex;
    } catch (err: any) {
        console.error('[LINK] PoW computation failed:', err);
        throw new Error(`Failed to compute PoW nonce: ${err.message}`);
    }
}

/**
 * Builds and broadcasts MsgLinkAccountPQC transaction
 */
export async function linkPqcAccount(
    wallet: LumenWallet,
    powNonceHex: string,
    apiEndpoint: string = DEFAULT_REST
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
        /* 1. Create signer from mnemonic */
        const signer = await DirectSecp256k1HdWallet.fromMnemonic(wallet.mnemonic, { prefix: 'lmn' });
        const accounts = await signer.getAccounts();

        /* 2. Get account info */
        const accountRes = await fetch(`${apiEndpoint}/cosmos/auth/v1beta1/accounts/${wallet.address}`);
        if (!accountRes.ok) {
            return { success: false, error: 'Failed to fetch account info' };
        }

        const accountData = await accountRes.json();
        const account = accountData.account;
        const sequence = BigInt(account.sequence || '0');
        const accountNumber = BigInt(account.account_number || '0');

        /* 3. Get PQC public key (support both new and legacy structures) */
        /* Important: check which one actually contains keys (rename can create partial objects). */
        const pqcData = ((wallet.pqcKey as any)?.publicKey || (wallet.pqcKey as any)?.public_key)
            ? wallet.pqcKey
            : (wallet.pqc?.publicKey || wallet.pqc?.public_key)
                ? (wallet as any).pqc
                : (wallet.pqcKey || (wallet as any).pqc); /* Fallback to whatever exists */

        if (!pqcData) {
            return { success: false, error: 'PQC public key data not found in wallet' };
        }

        /* 4. Build MsgLinkAccountPQC */
        const MSG_LINK_TYPE_URL = '/lumen.pqc.v1.MsgLinkAccountPQC';

        /* Manual protobuf encoding for MsgLinkAccountPQC */
        /* Structure: { creator: string, scheme: string, pubKey: bytes, powNonce: bytes } */

        /* Use a simple binary encoder (protobuf wire format) */
        /* Field 1: creator (string) - tag 10 (field 1, wire type 2=length-delimited) */
        /* Field 2: scheme (string) - tag 18 (field 2, wire type 2) */
        /* Field 3: pubKey (bytes) - tag 26 (field 3, wire type 2) */
        /* Field 4: powNonce (bytes) - tag 34 (field 4, wire type 2) */

        const creatorBytes = new TextEncoder().encode(wallet.address);
        const schemeBytes = new TextEncoder().encode('dilithium3');
        const pubKeyBytes = ensureUint8Array(pqcData.publicKey);
        const powNonceBytes = ensureUint8Array(powNonceHex);

        if (pubKeyBytes.length === 0) {
            return { success: false, error: 'PQC public key decoding failed (0 bytes)' };
        }

        /* Calculate total size */
        const creatorLen = creatorBytes.length;
        const schemeLen = schemeBytes.length;
        const pubKeyLen = pubKeyBytes.length;
        const powNonceLen = powNonceBytes.length;

        /* Varint encoding helper (simplified for small numbers) */
        const encodeVarint = (n: number): number[] => {
            const result: number[] = [];
            while (n > 127) {
                result.push((n & 0x7F) | 0x80);
                n >>>= 7;
            }
            result.push(n & 0x7F);
            return result;
        };

        /* Build message bytes */
        const msgBytes: number[] = [];

        /* Field 1: creator */
        msgBytes.push(0x0A); /* tag: field 1, wire type 2 */
        msgBytes.push(...encodeVarint(creatorLen));
        msgBytes.push(...Array.from(creatorBytes));

        /* Field 2: scheme */
        msgBytes.push(0x12); /* tag: field 2, wire type 2 */
        msgBytes.push(...encodeVarint(schemeLen));
        msgBytes.push(...Array.from(schemeBytes));

        /* Field 3: pubKey */
        msgBytes.push(0x1A); /* tag: field 3, wire type 2 */
        msgBytes.push(...encodeVarint(pubKeyLen));
        msgBytes.push(...Array.from(pubKeyBytes));

        /* Field 4: powNonce */
        msgBytes.push(0x22); /* tag: field 4, wire type 2 */
        msgBytes.push(...encodeVarint(powNonceLen));
        msgBytes.push(...Array.from(powNonceBytes));

        const msgEncoded = new Uint8Array(msgBytes);

        const msgAny = Any.fromPartial({
            typeUrl: MSG_LINK_TYPE_URL,
            value: msgEncoded
        });

        /* 4. Create TxBody */
        const txBody = TxBody.fromPartial({
            messages: [msgAny],
            memo: 'Link PQC Account'
        });
        const txBodyBytes = TxBody.encode(txBody).finish();

        /* 5. Create AuthInfo */
        const pubkeyAny = Any.fromPartial({
            typeUrl: '/cosmos.crypto.secp256k1.PubKey',
            value: PubKey.encode({ key: accounts[0].pubkey }).finish()
        });

        const authInfo = AuthInfo.fromPartial({
            signerInfos: [{
                publicKey: pubkeyAny,
                modeInfo: { single: { mode: SignMode.SIGN_MODE_DIRECT } },
                sequence: sequence
            }],
            fee: Fee.fromPartial({ amount: [], gasLimit: BigInt(200000) })
        });
        const authInfoBytes = AuthInfo.encode(authInfo).finish();

        /* 6. Sign (initial ECDSA for authInfo) */
        /* 7. Add PQC Signature Extension (Proof of Possession) */
        /* Even for linking, the chain's AnteHandler requires a PQC signature */
        /* extension to verify the key being linked belongs to the sender. */

        /* Get private key for signing */
        const rawPriv = pqcData.privateKey || pqcData.private_key || (pqcData as any).encryptedPrivateKey;
        const pqcPrivKey = ensureUint8Array(rawPriv);

        if (pqcPrivKey.length === 0) {
            return { success: false, error: 'PQC private key decoding failed (0 bytes)' };
        }

        /* PQC Sign Step 1: Compute sign bytes for the transaction structure */
        /* structure: { bodyBytes, authInfoBytes, signatures: [] } */
        const tempTxRaw = {
            bodyBytes: txBodyBytes,
            authInfoBytes: authInfoBytes,
            signatures: []
        };

        // @ts-ignore (Access internal SDK signature payload helper)
        const pqcPayload = LumenSDK.pqc.computeSignBytes(CHAIN_ID, Number(accountNumber), tempTxRaw);

        /* PQC Sign Step 2: Sign the payload with Dilithium3 */
        // @ts-ignore
        const pqcSigRaw = await LumenSDK.pqc.signDilithium(pqcPayload, pqcPrivKey);

        const pqcEntry = {
            addr: wallet.address,
            scheme: 'dilithium3',
            signature: new Uint8Array(pqcSigRaw),
            pubKey: pubKeyBytes
        };

        /* PQC Sign Step 3: Embed extension into TxBody */
        // @ts-ignore
        const finalTxBodyBytes = LumenSDK.pqc.withPqcExtension(txBodyBytes, [pqcEntry]);

        /* 8. Re-sign with ECDSA (must use the final body containing the extension) */
        const finalSignDoc = SignDoc.fromPartial({
            bodyBytes: finalTxBodyBytes,
            authInfoBytes: authInfoBytes,
            chainId: CHAIN_ID,
            accountNumber: accountNumber
        });

        const { signature } = await signer.signDirect(wallet.address, finalSignDoc);

        /* 9. Pack Final TxRaw */
        const txRaw = TxRaw.fromPartial({
            bodyBytes: finalTxBodyBytes,
            authInfoBytes: authInfoBytes,
            signatures: [Buffer.from(signature.signature, 'base64')]
        });

        const txBytes = TxRaw.encode(txRaw).finish();
        const txBytesBase64 = Buffer.from(txBytes).toString('base64');

        /* 8. Broadcast */
        const broadcastRes = await fetch(`${apiEndpoint}/cosmos/tx/v1beta1/txs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tx_bytes: txBytesBase64,
                mode: 'BROADCAST_MODE_SYNC'
            })
        });

        const broadcastData = await broadcastRes.json();

        if (!broadcastData.tx_response || broadcastData.tx_response.code !== 0) {
            const error = broadcastData.tx_response?.raw_log || 'Transaction rejected';
            console.error('[LINK] Broadcast failed:', error);
            return { success: false, error };
        }

        const txHash = broadcastData.tx_response.txhash;

        return { success: true, txHash };

    } catch (err: any) {
        console.error('[LINK] Link transaction error:', err);
        return { success: false, error: err.message || 'Unknown error' };
    }
}

/**
 * Checks if PQC account is already linked on-chain
 * Note: This requires querying the chain's PQC module
 */
export async function checkPqcAccountStatus(
    address: string,
    apiEndpoint: string = DEFAULT_REST
): Promise<LinkStatus> {
    try {
        /* Try to fetch PQC account info from chain */
        const res = await fetch(`${apiEndpoint}/lumen/pqc/v1/accounts/${address}`);

        if (!res.ok) {
            /* Account not found or not linked */
            return { isLinked: false };
        }

        const data = await res.json();
        if (data.account?.pqc_public_key) {
            return {
                isLinked: true,
                pqcPublicKey: data.account.pqc_public_key
            };
        }

        return { isLinked: false };
    } catch (err) {
        /* console.warn('[LINK] Could not check PQC account status:', err); */
        /* Assume not linked if we can't check */
        return { isLinked: false };
    }
}
