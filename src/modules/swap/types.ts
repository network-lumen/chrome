export interface OrderRequest {
  fromAsset: string;
  toAsset: string;
  fromAmount: string; // Decimal string (e.g. "100.0")
  payout: {
    chain: string;
    address: string;
  };
  refund: {
    addressLumen: string;
  };
  slippageBpsMax: number;
  client: {
    app: string;
    version: string;
  };
}

export interface Quote {
  fromAmount: string; // The input amount in LMN
  toAmount: string;
  rate: string;
  expiresAt: string; // ISO 8601
}

export interface OrderResponse {
  orderId: string;
  depositAddress: string;
  memo: string;
  quote: Quote;
  signature?: string; // Provider signature for verification
}

export const OrderStatus = {
  PENDING: 'PENDING',
  DEPOSIT_DETECTED: 'DEPOSIT_DETECTED',
  SWAPPING: 'SWAPPING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED'
} as const;

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];
