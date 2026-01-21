import { Buffer } from 'buffer';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { MsgDelegate, MsgUndelegate } from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import { MsgWithdrawDelegatorReward } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { TxRaw, SignDoc, TxBody, AuthInfo, Fee } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { Any } from 'cosmjs-types/google/protobuf/any';
import * as LumenSDK from '@lumen-chain/sdk';
import type { LumenWallet } from './key-manager';

const CHAIN_ID = "lumen";
const GAS_LIMIT = BigInt(300000);
const API_ENDPOINT = 'https://api-lumen.winnode.xyz';

/* Helper: Hex/Base64 Decoder */
const ensureUint8Array = (input: string | Uint8Array | undefined): Uint8Array => {
    if (!input) return new Uint8Array(0);
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed.length === 0) return new Uint8Array(0);

        if (/^[0-9a-fA-F]+$/.test(trimmed)) {
            try {
                const buf = Buffer.from(trimmed, 'hex');
                if (buf.length > 0) return new Uint8Array(buf);
            } catch (e) { }
        }

        try {
            const buf = Buffer.from(trimmed, 'base64');
            if (buf.length > 0) return new Uint8Array(buf);
            const binString = atob(trimmed);
            return new Uint8Array(binString.split('').map(c => c.charCodeAt(0)));
        } catch (e) {
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
async function fetchAccountInfo(address: string) {
    const res = await fetch(`${API_ENDPOINT}/cosmos/auth/v1beta1/accounts/${address}`);
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

/* Fetch Delegations */
export async function fetchDelegations(delegatorAddress: string) {
    try {
        const res = await fetch(`${API_ENDPOINT}/cosmos/staking/v1beta1/delegations/${delegatorAddress}`);
        if (!res.ok) {
            if (res.status === 404) return [];
            throw new Error(`Failed to fetch delegations: ${res.status}`);
        }
        const data = await res.json();
        return data.delegation_responses || [];
    } catch (error) {
        console.error('Error fetching delegations:', error);
        return [];
    }
}

/* Fetch Rewards */
export async function fetchRewards(delegatorAddress: string) {
    try {
        const res = await fetch(`${API_ENDPOINT}/cosmos/distribution/v1beta1/delegators/${delegatorAddress}/rewards`);
        if (!res.ok) {
            if (res.status === 404) return { total: [], rewards: [] };
            throw new Error(`Failed to fetch rewards: ${res.status}`);
        }
        const data = await res.json();
        return {
            total: data.total || [],
            rewards: data.rewards || []
        };
    } catch (error) {
        console.error('Error fetching rewards:', error);
        return { total: [], rewards: [] };
    }
}

/* Fetch Validators */
export async function fetchValidators() {
    try {
        const res = await fetch(`${API_ENDPOINT}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED`);
        if (!res.ok) {
            throw new Error(`Failed to fetch validators: ${res.status}`);
        }
        const data = await res.json();
        return data.validators || [];
    } catch (error) {
        console.error('Error fetching validators:', error);
        return [];
    }
}

/* Fetch Validator Info */
export async function fetchValidator(validatorAddress: string) {
    try {
        const res = await fetch(`${API_ENDPOINT}/cosmos/staking/v1beta1/validators/${validatorAddress}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch validator: ${res.status}`);
        }
        const data = await res.json();
        return data.validator;
    } catch (error) {
        console.error('Error fetching validator:', error);
        return null;
    }
}

/* Delegate Tokens */
export async function delegateTokens(
    walletData: LumenWallet,
    validatorAddress: string,
    amountUlmn: string
): Promise<string> {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(walletData.mnemonic, { prefix: 'lmn' });
    const [account] = await wallet.getAccounts();

    if (account.address !== walletData.address) {
        throw new Error(`Address mismatch`);
    }

    const { accountNumber, sequence } = await fetchAccountInfo(walletData.address);

    /* Prepare PQC Keys */
    const pqcData = walletData.pqcKey || walletData.pqc;
    if (!pqcData) throw new Error("Missing PQC key data");

    const rawPriv = pqcData.privateKey;
    const rawPub = pqcData.publicKey;
    if (!rawPriv || !rawPub) throw new Error("Missing PQC keys");

    const pqcPrivKey = ensureUint8Array(rawPriv);
    const pqcPubKey = ensureUint8Array(rawPub);

    if (pqcPubKey.length !== 1952 || pqcPrivKey.length !== 4000) {
        throw new Error("Invalid PQC key length");
    }

    /* Create Delegate Message */
    const msgDelegate = MsgDelegate.encode({
        delegatorAddress: walletData.address,
        validatorAddress: validatorAddress,
        amount: { denom: 'ulmn', amount: amountUlmn }
    }).finish();

    const msgAny = Any.fromPartial({
        typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
        value: msgDelegate
    });

    const txBody = TxBody.fromPartial({
        messages: [msgAny],
        memo: `Stake ${amountUlmn} ulmn`
    });
    const txBodyBytes = TxBody.encode(txBody).finish();

    /* Create AuthInfo */
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

    /* Generate PQC Signature */
    const tempTxRaw = {
        bodyBytes: txBodyBytes,
        authInfoBytes: authInfoBytes,
        signatures: []
    };

    // @ts-ignore
    const pqcPayload = LumenSDK.pqc.computeSignBytes(CHAIN_ID, Number(accountNumber), tempTxRaw);
    // @ts-ignore
    const pqcSigRaw = await LumenSDK.pqc.signDilithium(pqcPayload, pqcPrivKey);

    const pqcEntry = {
        addr: walletData.address,
        scheme: 'dilithium3',
        signature: new Uint8Array(pqcSigRaw),
        pubKey: pqcPubKey
    };

    // @ts-ignore
    let finalTxBodyBytes = LumenSDK.pqc.withPqcExtension(txBodyBytes, [pqcEntry]);

    /* Re-Sign ECDSA */
    const signDoc2 = SignDoc.fromPartial({
        bodyBytes: finalTxBodyBytes,
        authInfoBytes: authInfoBytes,
        chainId: CHAIN_ID,
        accountNumber: accountNumber
    });

    const { signature: finalSig } = await wallet.signDirect(walletData.address, signDoc2);

    /* Pack Final TxRaw */
    const txRaw = TxRaw.fromPartial({
        bodyBytes: finalTxBodyBytes,
        authInfoBytes: authInfoBytes,
        signatures: [Buffer.from(finalSig.signature, 'base64')]
    });

    const txBytes = TxRaw.encode(txRaw).finish();

    /* Broadcast */
    return await broadcastTx(txBytes);
}

/* Undelegate Tokens */
export async function undelegateTokens(
    walletData: LumenWallet,
    validatorAddress: string,
    amountUlmn: string
): Promise<string> {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(walletData.mnemonic, { prefix: 'lmn' });
    const [account] = await wallet.getAccounts();

    if (account.address !== walletData.address) {
        throw new Error(`Address mismatch`);
    }

    const { accountNumber, sequence } = await fetchAccountInfo(walletData.address);

    /* Prepare PQC Keys */
    const pqcData = walletData.pqcKey || walletData.pqc;
    if (!pqcData) throw new Error("Missing PQC key data");

    const rawPriv = pqcData.privateKey;
    const rawPub = pqcData.publicKey;
    if (!rawPriv || !rawPub) throw new Error("Missing PQC keys");

    const pqcPrivKey = ensureUint8Array(rawPriv);
    const pqcPubKey = ensureUint8Array(rawPub);

    if (pqcPubKey.length !== 1952 || pqcPrivKey.length !== 4000) {
        throw new Error("Invalid PQC key length");
    }

    /* Create Undelegate Message */
    const msgUndelegate = MsgUndelegate.encode({
        delegatorAddress: walletData.address,
        validatorAddress: validatorAddress,
        amount: { denom: 'ulmn', amount: amountUlmn }
    }).finish();

    const msgAny = Any.fromPartial({
        typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
        value: msgUndelegate
    });

    const txBody = TxBody.fromPartial({
        messages: [msgAny],
        memo: `Unstake ${amountUlmn} ulmn`
    });
    const txBodyBytes = TxBody.encode(txBody).finish();

    /* Create AuthInfo */
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

    /* Generate PQC Signature */
    const tempTxRaw = {
        bodyBytes: txBodyBytes,
        authInfoBytes: authInfoBytes,
        signatures: []
    };

    // @ts-ignore
    const pqcPayload = LumenSDK.pqc.computeSignBytes(CHAIN_ID, Number(accountNumber), tempTxRaw);
    // @ts-ignore
    const pqcSigRaw = await LumenSDK.pqc.signDilithium(pqcPayload, pqcPrivKey);

    const pqcEntry = {
        addr: walletData.address,
        scheme: 'dilithium3',
        signature: new Uint8Array(pqcSigRaw),
        pubKey: pqcPubKey
    };

    // @ts-ignore
    let finalTxBodyBytes = LumenSDK.pqc.withPqcExtension(txBodyBytes, [pqcEntry]);

    /* Re-Sign ECDSA */
    const signDoc2 = SignDoc.fromPartial({
        bodyBytes: finalTxBodyBytes,
        authInfoBytes: authInfoBytes,
        chainId: CHAIN_ID,
        accountNumber: accountNumber
    });

    const { signature: finalSig } = await wallet.signDirect(walletData.address, signDoc2);

    /* Pack Final TxRaw */
    const txRaw = TxRaw.fromPartial({
        bodyBytes: finalTxBodyBytes,
        authInfoBytes: authInfoBytes,
        signatures: [Buffer.from(finalSig.signature, 'base64')]
    });

    const txBytes = TxRaw.encode(txRaw).finish();

    /* Broadcast */
    return await broadcastTx(txBytes);
}

/* Claim Rewards */
export async function claimRewards(
    walletData: LumenWallet,
    validatorAddress: string
): Promise<string> {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(walletData.mnemonic, { prefix: 'lmn' });
    const [account] = await wallet.getAccounts();

    if (account.address !== walletData.address) {
        throw new Error(`Address mismatch`);
    }

    const { accountNumber, sequence } = await fetchAccountInfo(walletData.address);

    /* Prepare PQC Keys */
    const pqcData = walletData.pqcKey || walletData.pqc;
    if (!pqcData) throw new Error("Missing PQC key data");

    const rawPriv = pqcData.privateKey;
    const rawPub = pqcData.publicKey;
    if (!rawPriv || !rawPub) throw new Error("Missing PQC keys");

    const pqcPrivKey = ensureUint8Array(rawPriv);
    const pqcPubKey = ensureUint8Array(rawPub);

    if (pqcPubKey.length !== 1952 || pqcPrivKey.length !== 4000) {
        throw new Error("Invalid PQC key length");
    }

    /* Create Withdraw Reward Message */
    const msgWithdraw = MsgWithdrawDelegatorReward.encode({
        delegatorAddress: walletData.address,
        validatorAddress: validatorAddress
    }).finish();

    const msgAny = Any.fromPartial({
        typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
        value: msgWithdraw
    });

    const txBody = TxBody.fromPartial({
        messages: [msgAny],
        memo: 'Claim staking rewards'
    });
    const txBodyBytes = TxBody.encode(txBody).finish();

    /* Create AuthInfo */
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

    /* Generate PQC Signature */
    const tempTxRaw = {
        bodyBytes: txBodyBytes,
        authInfoBytes: authInfoBytes,
        signatures: []
    };

    // @ts-ignore
    const pqcPayload = LumenSDK.pqc.computeSignBytes(CHAIN_ID, Number(accountNumber), tempTxRaw);
    // @ts-ignore
    const pqcSigRaw = await LumenSDK.pqc.signDilithium(pqcPayload, pqcPrivKey);

    const pqcEntry = {
        addr: walletData.address,
        scheme: 'dilithium3',
        signature: new Uint8Array(pqcSigRaw),
        pubKey: pqcPubKey
    };

    // @ts-ignore
    let finalTxBodyBytes = LumenSDK.pqc.withPqcExtension(txBodyBytes, [pqcEntry]);

    /* Re-Sign ECDSA */
    const signDoc2 = SignDoc.fromPartial({
        bodyBytes: finalTxBodyBytes,
        authInfoBytes: authInfoBytes,
        chainId: CHAIN_ID,
        accountNumber: accountNumber
    });

    const { signature: finalSig } = await wallet.signDirect(walletData.address, signDoc2);

    /* Pack Final TxRaw */
    const txRaw = TxRaw.fromPartial({
        bodyBytes: finalTxBodyBytes,
        authInfoBytes: authInfoBytes,
        signatures: [Buffer.from(finalSig.signature, 'base64')]
    });

    const txBytes = TxRaw.encode(txRaw).finish();

    /* Broadcast */
    return await broadcastTx(txBytes);
}

/* Broadcaster */
async function broadcastTx(txBytes: Uint8Array): Promise<string> {
    const txBytesBase64 = Buffer.from(txBytes).toString('base64');

    const body = {
        tx_bytes: txBytesBase64,
        mode: 'BROADCAST_MODE_SYNC'
    };

    const res = await fetch(`${API_ENDPOINT}/cosmos/tx/v1beta1/txs`, {
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
