import { useState, useEffect } from 'react';
import { type OrderHistoryItem, STORAGE_KEY_ORDERS } from './storage';

export function useOrderHistory() {
    const [orders, setOrders] = useState<OrderHistoryItem[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY_ORDERS);
        if (stored) {
            try {
                setOrders(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse order history', e);
            }
        }
    }, []);

    const addOrder = (order: OrderHistoryItem) => {
        setOrders(prev => {
            const updated = [order, ...prev];
            localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
            return updated;
        });
    };

    const updateOrder = (id: string, updates: Partial<OrderHistoryItem>) => {
        setOrders(prev => {
            const updated = prev.map(o => o.id === id ? { ...o, ...updates } : o);
            localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
            return updated;
        });
    };

    return { orders, addOrder, updateOrder };
}
