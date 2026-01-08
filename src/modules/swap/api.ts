// Mock URL, in reality likely different

// Types matching Mode B Spec
export interface CreateOrderRequest {
    fromAsset: string;
    toAsset: string;
    fromAmount: string;
    payout: {
        chain: string;
        address: string;
    };
    refund: {
        addressLumen: string;
    };
    client: {
        app: string;
        version: string;
    };
}

export interface QuoteResponse {
    orderId: string;
    providerId: string;
    deposit: {
        address: string;
        amount: string;
        memo: string;
        chain: string; // 'lumen'
    };
    payout: {
        amount: string; // Estimated
        chain: string;
        address: string;
    };
    expiresAt: number; // Timestamp
    signature: string; // Provider signature of the quote (optional for v1 but good for Mode B)
}

export interface OrderStatusResponse {
    orderId: string;
    status: 'PENDING_DEPOSIT' | 'DEPOSIT_SEEN' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
    txHashIn?: string;
    txHashOut?: string;
}

export const SwapApi = {
    createOrder: async (req: CreateOrderRequest): Promise<QuoteResponse> => {
        // Mock Implementation for MVP / Local Demo
        // In real Mode B, this hits the Aggregator API.

        // Simulating network delay
        await new Promise(r => setTimeout(r, 800));

        const rate = 1.5; // 1 LMN = 1.5 USDC (Mock)
        const estPayout = (parseFloat(req.fromAmount) * rate).toFixed(2);

        return {
            orderId: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            providerId: 'lumen-internal-swap', // Must match allowlist
            deposit: {
                address: 'lumen1mockdepositaddressxxxxxxxxxxxx', // This should be a dynamic deposit address from the provider
                amount: req.fromAmount,
                memo: `SWAP:${req.toAsset}:${req.payout.address}`,
                chain: 'lumen'
            },
            payout: {
                amount: estPayout,
                chain: req.payout.chain,
                address: req.payout.address
            },
            expiresAt: Date.now() + 1000 * 60 * 15, // 15 mins
            signature: 'mock_sig'
        };
    },

    getOrderStatus: async (orderId: string): Promise<OrderStatusResponse> => {
        // Mock polling logic
        // In reality, fetch from API
        await new Promise(r => setTimeout(r, 500));

        // Deterministic mock status based on time (for demo)
        // This logic is purely for the UI to transition states in the demo
        return {
            orderId,
            status: 'PENDING_DEPOSIT'
            // In a real flow, checking the actual status requires backend persistence
        };
    }
};
