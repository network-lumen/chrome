import type { QuoteResponse } from './api';
import { isProviderAllowed } from './providers';
import { buildAndSignSendTx, broadcastTx } from '../sdk/tx';
import type { LumenWallet } from '../sdk/key-manager';

export const SwapOrchestrator = {
    /**
     * Step 1: Validate the Quote received from API.
     * Enforces Security Invariants.
     */
    validateQuote: (quote: QuoteResponse) => {
        // 1. Expiry Check
        if (Date.now() > quote.expiresAt) {
            throw new Error("Quote has expired.");
        }

        // 2. Allowlist Check
        if (!isProviderAllowed(quote.providerId)) {
            throw new Error(`Security Warning: Provider '${quote.providerId}' is not in the allowlist.`);
        }

        // 3. Deposit Address Validation
        if (!quote.deposit.address.startsWith('lmn')) {
            throw new Error(`Invalid deposit address format: ${quote.deposit.address}`);
        }

        if (quote.deposit.amount !== quote.deposit.amount) {
            // Check for NaN or weird values
            throw new Error("Invalid deposit amount.");
        }

        return true;
    },

    /**
     * Step 2: Construct & Sign Local Transaction.
     * NEVER sign a payload provided directly by the API.
     * We accept the 'quote' but build the 'MsgSend' ourselves.
     */
    executeSwap: async (wallet: LumenWallet, quote: QuoteResponse) => {
        // Double check validation
        SwapOrchestrator.validateQuote(quote);

        // Convert amount to ulmn (Assuming API returns LMN decimal string)
        const amountUlmn = (parseFloat(quote.deposit.amount) * 1_000_000).toFixed(0);

        // Required Memo format for the Bridge/Provider to route the funds
        const memo = quote.deposit.memo;

        // Sign
        const txBytes = await buildAndSignSendTx(
            wallet,
            quote.deposit.address,
            amountUlmn,
            memo
        );

        // Broadcast
        return await broadcastTx(txBytes);
    }
};
