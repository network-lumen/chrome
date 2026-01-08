import React from 'react';
import { useOrderHistory } from '../../modules/swap/useOrderHistory';
import { OrderStatus } from '../../modules/swap/types';

export const OrderHistory: React.FC = () => {
    const { orders } = useOrderHistory();

    if (orders.length === 0) {
        return (
            <div className="text-center text-gray-500 py-8 text-sm">
                No orders history yet.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {orders.map((order) => (
                <div key={order.id} className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-center">
                    <div>
                        <div className="text-white font-mono text-sm">{order.id.slice(0, 8)}...</div>
                        <div className="text-xs text-gray-400">
                            {new Date(order.createdAt).toLocaleString()}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-white font-bold">{order.fromAmount} LMN</div>
                        <div className={`text-xs px-2 py-0.5 rounded capitalize ${order.status === OrderStatus.COMPLETED ? 'bg-green-900 text-green-300' :
                                order.status === OrderStatus.FAILED ? 'bg-red-900 text-red-300' :
                                    'bg-yellow-900 text-yellow-300'
                            }`}>
                            {order.status.toLowerCase()}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
