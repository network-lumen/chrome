import { Buffer } from 'buffer';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { TxRaw, SignDoc, TxBody, AuthInfo, Fee } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { Any } from 'cosmjs-types/google/protobuf/any';
import * as LumenSDK from '@lumen-chain/sdk';

// Import types
import type { LumenWallet } from './key-manager';

/* Config */
const CHAIN_ID = "lumen";
const GAS_LIMIT = BigInt(200000);
const DEFAULT_REST = "https://api-lumen.winnode.xyz";

/* Helper: Hex/Base64 Decoder */
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

/* Helper: Account Info */
async function fetchAccountInfo(address: string, apiEndpoint: string = DEFAULT_REST) {
    const res = await fetch(`${apiEndpoint}/cosmos/auth/v1beta1/accounts/${address}`);
    if (!res.ok) {
        throw new Error(`Account fetch failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const acc = data.account || data;
    return {
        accountNumber: BigInt(acc.account_number || 0),
        sequence: BigInt(acc.sequence || 0)
    };
}

/* Main Function */
export async function buildAndSignSendTx(
    walletData: LumenWallet,
    toAddress: string,
    amountUlmn: string,
    memo: string,
    apiEndpoint: string = DEFAULT_REST
): Promise<Uint8Array> {

    /* 1. Prepare ECDSA Wallet */
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(walletData.mnemonic, { prefix: 'lmn' });
    const [account] = await wallet.getAccounts();

    /* Verify address matches */
    if (account.address !== walletData.address) {
        throw new Error(`Mnemonic derived address ${account.address} does not match wallet address ${walletData.address}`);
    }

    const { accountNumber, sequence } = await fetchAccountInfo(walletData.address, apiEndpoint);

    /* 2. Prepare Keys (Decoded) */
    /* Support both new 'pqcKey' and legacy 'pqc' structures. */
    /* Important: check which one actually contains keys (rename can create partial objects). */
    const pqcData = ((walletData.pqcKey as any)?.publicKey || (walletData.pqcKey as any)?.public_key)
        ? walletData.pqcKey
        : ((walletData.pqc as any)?.publicKey || (walletData.pqc as any)?.public_key)
            ? walletData.pqc
            : (walletData.pqcKey || walletData.pqc); /* Fallback to whatever exists */

    if (!pqcData) {
        throw new Error("Wallet is missing PQC key data. Please re-import your wallet.");
    }

    /* Extraction with fallbacks */
    const rawPriv = pqcData.privateKey || pqcData.private_key || pqcData.encryptedPrivateKey;
    const rawPub = pqcData.publicKey || pqcData.public_key;

    if (!rawPriv || !rawPub) {
        throw new Error("PQC keys missing sub-properties. Please re-import your wallet.");
    }

    /* Use ensureUint8Array to safely decode Hex (new) or Base64 (old) */
    const pqcPrivKey = ensureUint8Array(rawPriv);
    const pqcPubKey = ensureUint8Array(rawPub);

    /* Validate Keys (Strict) */
    /* Dilithium3: PubKey = 1952 bytes, PrivKey = 4000 bytes */
    if (pqcPubKey.length !== 1952) {
        throw new Error(`Invalid PQC Public Key. Expected 1952 bytes, got ${pqcPubKey.length}. Please re-import your wallet.`);
    }

    if (pqcPrivKey.length !== 4000) {
        throw new Error(`Invalid PQC Private Key Length: ${pqcPrivKey.length} (Expected 4000)`);
    }

    /* 3. Create TxBody (Standard) */
    const msgSend = MsgSend.encode({
        fromAddress: walletData.address,
        toAddress: toAddress,
        amount: [{ denom: 'ulmn', amount: amountUlmn }]
    }).finish();

    const msgAny = Any.fromPartial({
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: msgSend
    });

    const txBody = TxBody.fromPartial({
        messages: [msgAny],
        memo: memo
    });
    const txBodyBytes = TxBody.encode(txBody).finish();

    /* 4. Create AuthInfo */
    const pubKeyAny = Any.fromPartial({
        typeUrl: '/cosmos.crypto.secp256k1.PubKey',
        value: PubKey.encode({ key: account.pubkey }).finish()
    });

    const authInfo = AuthInfo.fromPartial({
        signerInfos: [{
            publicKey: pubKeyAny,
            modeInfo: { single: { mode: SignMode.SIGN_MODE_DIRECT } },
            sequence: sequence
        }],
        fee: Fee.fromPartial({ amount: [], gasLimit: GAS_LIMIT })
    });
    const authInfoBytes = AuthInfo.encode(authInfo).finish();

    /* 5. Generate PQC Signature */

    /* Use SDK's computeSignBytes to ensure exact match with Chain AnteHandler */
    /* structure: { bodyBytes, authInfoBytes, signatures: [] } */
    const tempTxRaw = {
        bodyBytes: txBodyBytes,
        authInfoBytes: authInfoBytes,
        signatures: []
    };

    // @ts-ignore
    const pqcPayload = LumenSDK.pqc.computeSignBytes(CHAIN_ID, Number(accountNumber), tempTxRaw);

    // @ts-ignore (Access internal SDK)
    const pqcSigRaw = await LumenSDK.pqc.signDilithium(pqcPayload, pqcPrivKey);

    /* Construct PQC Entry */
    /* Important: The SDK expects camelCase 'pubKey', not snake_case 'public_key' */
    /* (snake_case is only used in wallet storage, not transactions) */
    const pqcEntry = {
        addr: walletData.address,
        scheme: 'dilithium3',
        signature: new Uint8Array(pqcSigRaw),
        pubKey: pqcPubKey  /* SDK expects camelCase and Uint8Array format */
    };

    /* 6. Embed PQC Extension (Goes to NonCritical by default in SDK) */
    // @ts-ignore
    let finalTxBodyBytes = LumenSDK.pqc.withPqcExtension(txBodyBytes, [pqcEntry]);

    /* 7. Verification */
    const decodedBody = TxBody.decode(finalTxBodyBytes);
    const PQC_TYPE_URL = "/lumen.pqc.v1.PQCSignatures";

    const qcExtIndex = decodedBody.nonCriticalExtensionOptions.findIndex(e => e.typeUrl === PQC_TYPE_URL);
    if (qcExtIndex !== -1) {
        /* Found PQC in NonCritical */
    } else {
        /* Check Critical... */
    }

    /* Final Verification */
    const finalDecoded = TxBody.decode(finalTxBodyBytes);
    const hasPqc = finalDecoded.nonCriticalExtensionOptions.some(e => e.typeUrl === PQC_TYPE_URL) ||
        finalDecoded.extensionOptions.some(e => e.typeUrl === PQC_TYPE_URL);

    if (!hasPqc) {
        throw new Error("Failed to attach PQC Extension");
    }

    /* 8. Re-Sign ECDSA (Round 2) */
    /* We must sign the NEW body that contains the PQC extension */
    const signDoc2 = SignDoc.fromPartial({
        bodyBytes: finalTxBodyBytes, /* <--- NOTE: finalTxBodyBytes */
        authInfoBytes: authInfoBytes,
        chainId: CHAIN_ID,
        accountNumber: accountNumber
    });

    const { signature: finalSig } = await wallet.signDirect(walletData.address, signDoc2);

    /* 9. Pack Final TxRaw */
    const txRaw = TxRaw.fromPartial({
        bodyBytes: finalTxBodyBytes,
        authInfoBytes: authInfoBytes,
        signatures: [Buffer.from(finalSig.signature, 'base64')]
    });

    return TxRaw.encode(txRaw).finish();
}

/* 3. Broadcaster */
export async function broadcastTx(txBytes: Uint8Array, restUrl: string = DEFAULT_REST): Promise<string> {
    const txBytesBase64 = Buffer.from(txBytes).toString('base64');

    const body = {
        tx_bytes: txBytesBase64,
        mode: 'BROADCAST_MODE_SYNC'
    };

    const res = await fetch(`${restUrl}/cosmos/tx/v1beta1/txs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok || data.tx_response?.code !== 0) {
        console.error("[TX] Broadcast Failed:", data);
        throw new Error(data.tx_response?.raw_log || JSON.stringify(data));
    }

    return data.tx_response.txhash;
}
