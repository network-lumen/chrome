import { useState } from 'react';
import { buildAndSignIbcTransferTx, buildAndSignSendTx, broadcastTx } from '../modules/sdk/tx';
import { NetworkManager } from '../modules/sdk/network';
import type { LumenWallet } from '../modules/sdk/key-manager';

interface SendState {
    isLoading: boolean;
    error: string | null;
    successHash: string | null;
}

export const useSendTransaction = () => {
    const [state, setState] = useState<SendState>({
        isLoading: false,
        error: null,
        successHash: null
    });

    const runTransaction = async (
        builder: (preferredEndpoint: string) => Promise<{ txBytes: Uint8Array; endpoint: string }>
    ) => {
        setState({ isLoading: true, error: null, successHash: null });

        try {
            const nm = NetworkManager.getInstance();
            await nm.sync();
            const preferredEndpoint = await nm.getRestEndpoint();

            await new Promise(r => setTimeout(r, 100));
            const { txBytes, endpoint } = await builder(preferredEndpoint);
            const txHash = await broadcastTx(txBytes, endpoint);

            setState({
                isLoading: false,
                error: null,
                successHash: txHash
            });

            return txHash;

        } catch (e: any) {
            console.error(e);
            setState({
                isLoading: false,
                error: e.message || "Transaction failed.",
                successHash: null
            });
            throw e;
        }
    };

    const sendTransaction = async (
        fromWallet: LumenWallet,
        toAddress: string,
        amountLmn: string,
        memo: string = ''
    ) => {
        const amount = parseFloat(amountLmn);
        if (isNaN(amount) || amount <= 0) {
            throw new Error("Invalid amount.");
        }
        if (!toAddress.startsWith('lmn1')) {
            throw new Error("Invalid recipient address. Must start with 'lmn1'.");
        }

        const amountUlmn = Math.round(amount * 1_000_000).toString();
        return runTransaction((preferredEndpoint) =>
            buildAndSignSendTx(fromWallet, toAddress, amountUlmn, memo, preferredEndpoint)
        );
    };

    const ibcTransfer = async (
        fromWallet: LumenWallet,
        toAddress: string,
        amountLmn: string,
        options: {
            memo?: string;
            sourceChannel: string;
            sourcePort?: string;
            timeoutSeconds?: number;
        }
    ) => {
        const amount = parseFloat(amountLmn);
        if (isNaN(amount) || amount <= 0) {
            throw new Error("Invalid amount.");
        }
        if (!options.sourceChannel) {
            throw new Error("Missing IBC route.");
        }

        const amountUlmn = Math.round(amount * 1_000_000).toString();
        return runTransaction((preferredEndpoint) =>
            buildAndSignIbcTransferTx(
                fromWallet,
                toAddress,
                amountUlmn,
                options.memo || '',
                options.sourceChannel,
                options.sourcePort || 'transfer',
                options.timeoutSeconds ?? 600,
                preferredEndpoint
            )
        );
    };

    const resetState = () => {
        setState({ isLoading: false, error: null, successHash: null });
    };

    return {
        ...state,
        sendTransaction,
        ibcTransfer,
        resetState
    };
};
