import { OrderStatus } from './types';

export interface OrderHistoryItem {
    id: string; // Order ID
    createdAt: number; // Timestamp
    fromAmount: string;
    toAsset: string;
    status: OrderStatus;
    txHash?: string; // If signed
    depositAddress: string;
    memo: string;
}

export const STORAGE_KEY_ORDERS = 'lumen_extension_orders';
