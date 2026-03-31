import { useState } from 'react';
import {
    buildAndSignIbcTransferTx,
    buildAndSignSendTx,
    broadcastTx,
    signAndBroadcastStandardIbcTransferTx,
    signAndBroadcastStandardSendTx
} from '../modules/sdk/tx';
import { NetworkManager } from '../modules/sdk/network';
import type { LumenWallet } from '../modules/sdk/key-manager';

interface SendState {
    isLoading: boolean;
    error: string | null;
    successHash: string | null;
}

interface StandardTxContext {
    useStandardTx?: boolean;
    fromAddress?: string;
    addressPrefix?: string;
    rpcEndpoint?: string;
    feeDenom?: string;
    minGasPrice?: number;
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
        memo: string = '',
        options: StandardTxContext & {
            denom?: string;
        } = {}
    ) => {
        const amount = parseFloat(amountLmn);
        if (isNaN(amount) || amount <= 0) {
            throw new Error("Invalid amount.");
        }
        if (!toAddress.includes('1')) {
            throw new Error("Invalid recipient address.");
        }

        const amountUlmn = Math.round(amount * 1_000_000).toString();
        const denom = options.denom || 'ulmn';

        if (options.useStandardTx) {
            if (!options.fromAddress || !options.addressPrefix || !options.rpcEndpoint || !options.feeDenom) {
                throw new Error('Missing source chain configuration.');
            }

            setState({ isLoading: true, error: null, successHash: null });
            try {
                const txHash = await signAndBroadcastStandardSendTx({
                    mnemonic: fromWallet.mnemonic,
                    prefix: options.addressPrefix,
                    fromAddress: options.fromAddress,
                    toAddress,
                    amount: amountUlmn,
                    denom,
                    memo,
                    rpcEndpoint: options.rpcEndpoint,
                    feeDenom: options.feeDenom,
                    minGasPrice: options.minGasPrice ?? 0.01
                });

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
        }

        return runTransaction((preferredEndpoint) =>
            buildAndSignSendTx(fromWallet, toAddress, amountUlmn, memo, preferredEndpoint, denom)
        );
    };

    const ibcTransfer = async (
        fromWallet: LumenWallet,
        toAddress: string,
        amountLmn: string,
        options: StandardTxContext & {
            memo?: string;
            sourceChannel: string;
            sourcePort?: string;
            timeoutSeconds?: number;
            denom?: string;
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
        const denom = options.denom || 'ulmn';

        if (options.useStandardTx) {
            if (!options.fromAddress || !options.addressPrefix || !options.rpcEndpoint || !options.feeDenom) {
                throw new Error('Missing source chain configuration.');
            }

            setState({ isLoading: true, error: null, successHash: null });
            try {
                const txHash = await signAndBroadcastStandardIbcTransferTx({
                    mnemonic: fromWallet.mnemonic,
                    prefix: options.addressPrefix,
                    fromAddress: options.fromAddress,
                    toAddress,
                    amount: amountUlmn,
                    denom,
                    memo: options.memo || '',
                    rpcEndpoint: options.rpcEndpoint,
                    feeDenom: options.feeDenom,
                    minGasPrice: options.minGasPrice ?? 0.01,
                    sourceChannel: options.sourceChannel,
                    sourcePort: options.sourcePort || 'transfer',
                    timeoutSeconds: options.timeoutSeconds ?? 600
                });

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
        }

        return runTransaction((preferredEndpoint) =>
            buildAndSignIbcTransferTx(
                fromWallet,
                toAddress,
                amountUlmn,
                options.memo || '',
                options.sourceChannel,
                options.sourcePort || 'transfer',
                options.timeoutSeconds ?? 600,
                preferredEndpoint,
                denom
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
