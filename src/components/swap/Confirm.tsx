import React from 'react';
import type { OrderResponse } from '../../modules/swap/types';

interface ConfirmProps {
    order: OrderResponse;
    onConfirm: () => void;
    onCancel: () => void;
    isSigning: boolean;
}

export const Confirm: React.FC<ConfirmProps> = ({ order, onConfirm, onCancel, isSigning }) => {
    const { quote, depositAddress, memo } = order;
    const expiresAt = new Date(quote.expiresAt);
    const timeLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4">Confirm Swap</h2>

                <div className="space-y-4">
                    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                        <div className="text-gray-400 text-xs uppercase">Provider</div>
                        <div className="text-green-400 font-mono font-medium">Lumen Swap Provider (Verified)</div>
                    </div>

                    <div className="flex justify-between items-center">
                        <div>
                            <div className="text-gray-400 text-xs">Send</div>
                            <div className="text-white font-bold text-lg">{quote.fromAmount} LMN</div>
                        </div>
                        <div className="text-gray-500">→</div>
                        <div className="text-right">
                            <div className="text-gray-400 text-xs">Receive (Est)</div>
                            <div className="text-blue-400 font-bold text-lg">{quote.toAmount} {order.quote.toAmount}</div>
                        </div>
                    </div>

                    <div className="border-t border-gray-700 my-2"></div>

                    <div>
                        <div className="text-gray-400 text-xs mb-1">Deposit Address</div>
                        <div className="text-gray-300 font-mono text-sm break-all bg-black/30 p-2 rounded">
                            {depositAddress}
                        </div>
                    </div>

                    <div>
                        <div className="text-gray-400 text-xs mb-1">Memo (Order ID)</div>
                        <div className="text-yellow-200 font-mono text-sm bg-black/30 p-2 rounded">
                            {memo}
                        </div>
                    </div>

                    <div className="text-center text-xs text-red-400 mt-2">
                        Expires in {timeLeft}s
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onCancel}
                        disabled={isSigning}
                        className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isSigning || timeLeft <= 0}
                        className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 rounded-lg text-white font-bold"
                    >
                        {isSigning ? 'Signing...' : 'Sign & Broadcast'}
                    </button>
                </div>
            </div>
        </div>
    );
};
