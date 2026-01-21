import { Buffer } from 'buffer';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { MsgVote } from 'cosmjs-types/cosmos/gov/v1beta1/tx';
import { VoteOption } from 'cosmjs-types/cosmos/gov/v1beta1/gov';
import { TxRaw, SignDoc, TxBody, AuthInfo, Fee } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { Any } from 'cosmjs-types/google/protobuf/any';
import * as LumenSDK from '@lumen-chain/sdk';
import type { LumenWallet } from './key-manager';

const CHAIN_ID = "lumen";
const GAS_LIMIT = BigInt(200000);

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
async function fetchAccountInfo(address: string, apiEndpoint: string) {
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

/* Vote Option Mapping */
function mapVoteOption(option: 'yes' | 'no' | 'abstain' | 'veto'): VoteOption {
    switch (option) {
        case 'yes': return VoteOption.VOTE_OPTION_YES;
        case 'no': return VoteOption.VOTE_OPTION_NO;
        case 'abstain': return VoteOption.VOTE_OPTION_ABSTAIN;
        case 'veto': return VoteOption.VOTE_OPTION_NO_WITH_VETO;
    }
}

/* Main Voting Function */
export async function voteOnProposal(
    walletData: LumenWallet,
    proposalId: string,
    voteOption: 'yes' | 'no' | 'abstain' | 'veto',
    apiEndpoint: string
): Promise<string> {

    /* 1. Prepare ECDSA Wallet */
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(walletData.mnemonic, { prefix: 'lmn' });
    const [account] = await wallet.getAccounts();

    /* Verify address matches */
    if (account.address !== walletData.address) {
        throw new Error(`Mnemonic derived address ${account.address} does not match wallet address ${walletData.address}`);
    }

    const { accountNumber, sequence } = await fetchAccountInfo(walletData.address, apiEndpoint);

    /* 2. Prepare PQC Keys */
    const pqcData = ((walletData.pqcKey as any)?.publicKey || (walletData.pqcKey as any)?.public_key)
        ? walletData.pqcKey
        : ((walletData.pqc as any)?.publicKey || (walletData.pqc as any)?.public_key)
            ? walletData.pqc
            : (walletData.pqcKey || walletData.pqc);

    if (!pqcData) {
        throw new Error("Wallet is missing PQC key data. Please re-import your wallet.");
    }

    const rawPriv = pqcData.privateKey || pqcData.private_key || pqcData.encryptedPrivateKey;
    const rawPub = pqcData.publicKey || pqcData.public_key;

    if (!rawPriv || !rawPub) {
        throw new Error("PQC keys missing sub-properties. Please re-import your wallet.");
    }

    const pqcPrivKey = ensureUint8Array(rawPriv);
    const pqcPubKey = ensureUint8Array(rawPub);

    /* Validate Keys */
    if (pqcPubKey.length !== 1952) {
        throw new Error(`Invalid PQC Public Key. Expected 1952 bytes, got ${pqcPubKey.length}. Please re-import your wallet.`);
    }

    if (pqcPrivKey.length !== 4000) {
        throw new Error(`Invalid PQC Private Key Length: ${pqcPrivKey.length} (Expected 4000)`);
    }

    /* 3. Create Vote Message */
    const msgVote = MsgVote.encode({
        proposalId: BigInt(proposalId),
        voter: walletData.address,
        option: mapVoteOption(voteOption)
    }).finish();

    const msgAny = Any.fromPartial({
        typeUrl: '/cosmos.gov.v1beta1.MsgVote',
        value: msgVote
    });

    const txBody = TxBody.fromPartial({
        messages: [msgAny],
        memo: `Vote ${voteOption} on proposal #${proposalId}`
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

    /* 6. Embed PQC Extension */
    // @ts-ignore
    let finalTxBodyBytes = LumenSDK.pqc.withPqcExtension(txBodyBytes, [pqcEntry]);

    /* 7. Re-Sign ECDSA */
    const signDoc2 = SignDoc.fromPartial({
        bodyBytes: finalTxBodyBytes,
        authInfoBytes: authInfoBytes,
        chainId: CHAIN_ID,
        accountNumber: accountNumber
    });

    const { signature: finalSig } = await wallet.signDirect(walletData.address, signDoc2);

    /* 8. Pack Final TxRaw */
    const txRaw = TxRaw.fromPartial({
        bodyBytes: finalTxBodyBytes,
        authInfoBytes: authInfoBytes,
        signatures: [Buffer.from(finalSig.signature, 'base64')]
    });

    const txBytes = TxRaw.encode(txRaw).finish();

    /* 9. Broadcast */
    return await broadcastTx(txBytes, apiEndpoint);
}

/* Broadcaster */
async function broadcastTx(txBytes: Uint8Array, restUrl: string): Promise<string> {
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
