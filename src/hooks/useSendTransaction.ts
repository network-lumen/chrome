import { useState } from 'react';
import { buildAndSignSendTx, broadcastTx } from '../modules/sdk/tx';
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

    const sendTransaction = async (
        fromWallet: LumenWallet,
        toAddress: string,
        amountLmn: string,
        memo: string = ''
    ) => {
        setState({ isLoading: true, error: null, successHash: null });

        try {
            // Give UI time to render the loading state/spinner before heavy blocking crypto
            await new Promise(r => setTimeout(r, 100));
            // 1. Validation
            const amount = parseFloat(amountLmn);
            if (isNaN(amount) || amount <= 0) {
                throw new Error("Invalid amount.");
            }
            if (!toAddress.startsWith('lmn1')) {
                throw new Error("Invalid recipient address. Must start with 'lmn1'.");
            }

            // 2. Conversion (LMN -> ulmn)
            // Using BigInt/string math to avoid float precision issues is better, but for MVP float * 1m is ok
            // strictly speaking, we should use a library like 'decimal.js' or careful string parsing.
            // For now: 
            const amountUlmn = Math.round(amount * 1_000_000).toString();

            // 3. Build & Sign (Dual Sign)
            // Updated signature matches new tx.ts
            const txBytes = await buildAndSignSendTx(fromWallet, toAddress, amountUlmn, memo);

            // 4. Broadcast
            const txHash = await broadcastTx(txBytes);

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

    const resetState = () => {
        setState({ isLoading: false, error: null, successHash: null });
    };

    return {
        ...state,
        sendTransaction,
        resetState
    };
};
