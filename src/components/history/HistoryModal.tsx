import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, X, ExternalLink, Clock } from 'lucide-react';

interface HistoryModalProps {
    address: string;
    onClose: () => void;
}

interface Transaction {
    hash: string;
    height: string;
    timestamp: string;
    type: 'send' | 'receive';
    amount: string;
    denom: string;
    counterparty: string;
    status: 'success' | 'failed';
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ address, onClose }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                const API_BASE = "http://142.132.201.187:1317";

                /* Fetch Sent */
                /* Note: Removing order_by as it can cause 500s on some nodes. Pagination default is usually latest first or random. */
                const sentRes = await fetch(`${API_BASE}/cosmos/tx/v1beta1/txs?events=message.sender='${address}'&pagination.limit=20`);
                const sentData = await sentRes.json();

                /* Fetch Received */
                const receivedRes = await fetch(`${API_BASE}/cosmos/tx/v1beta1/txs?events=transfer.recipient='${address}'&pagination.limit=20`);
                const receivedData = await receivedRes.json();

                const parsed: Transaction[] = [];

                /* Helper to parse amount string "1000ulmn" */
                const parseAmount = (coins: any[]) => {
                    if (!coins || coins.length === 0) return { amount: '0', denom: '' };
                    const coin = coins[0]; /* Take first coin */
                    /* Convert ulmn to LMN */
                    if (coin.denom === 'ulmn') {
                        return {
                            amount: (parseFloat(coin.amount) / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 }),
                            denom: 'LMN'
                        };
                    }
                    return { amount: coin.amount, denom: coin.denom };
                };

                /* Process Sent */
                if (sentData.tx_responses) {
                    sentData.tx_responses.forEach((tx: any) => {
                        /* Find the message that matters (Bank Send) */
                        const msg = tx.tx.body.messages.find((m: any) => m['@type'] === '/cosmos.bank.v1beta1.MsgSend');
                        if (msg) {
                            const { amount, denom } = parseAmount(msg.amount);
                            parsed.push({
                                hash: tx.txhash,
                                height: tx.height,
                                timestamp: tx.timestamp,
                                type: 'send',
                                amount,
                                denom,
                                counterparty: msg.to_address,
                                status: tx.code === 0 ? 'success' : 'failed'
                            });
                        }
                    });
                }

                /* Process Received */
                if (receivedData.tx_responses) {
                    receivedData.tx_responses.forEach((tx: any) => {
                        const msg = tx.tx.body.messages.find((m: any) => m['@type'] === '/cosmos.bank.v1beta1.MsgSend' && m.to_address === address);
                        if (msg) {
                            const { amount, denom } = parseAmount(msg.amount);
                            parsed.push({
                                hash: tx.txhash,
                                height: tx.height,
                                timestamp: tx.timestamp,
                                type: 'receive',
                                amount,
                                denom,
                                counterparty: msg.from_address,
                                status: tx.code === 0 ? 'success' : 'failed'
                            });
                        }
                    });
                }

                /* Sort by height desc (newest first) -> simple string compare works for same-length-ish heights, but better parse int */
                parsed.sort((a, b) => parseInt(b.height) - parseInt(a.height));

                setTransactions(parsed);
            } catch (err: any) {
                console.error("History fetch failed", err);
                setError("Failed to load history");
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [address]);

    const filtered = transactions.filter(t => filter === 'all' || (filter === 'sent' ? t.type === 'send' : t.type === 'receive'));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm h-[600px] max-h-[90vh] bg-surface border border-border rounded-xl shadow-2xl flex flex-col relative overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-surface/80 backdrop-blur z-10">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        History
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-surfaceHighlight rounded-full transition-colors text-[var(--text-muted)] hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-2 flex gap-2 bg-surfaceHighlight/30">
                    {(['all', 'sent', 'received'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${filter === f
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-[var(--text-muted)] hover:bg-surfaceHighlight hover:text-foreground'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs">Loading on-chain data...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                            <p className="text-red-500 text-sm font-medium">{error}</p>
                            <button onClick={() => window.location.reload()} className="text-xs text-primary hover:underline">Retry</button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2">
                            <div className="w-12 h-12 bg-surfaceHighlight rounded-full flex items-center justify-center">
                                <Clock className="w-6 h-6 opacity-30" />
                            </div>
                            <p className="text-sm">No transactions found</p>
                        </div>
                    ) : (
                        filtered.map((tx) => (
                            <div key={tx.hash} className="group bg-surface hover:bg-surfaceHighlight border border-border rounded-xl p-3 transition-all cursor-default">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                                            tx.type === 'send' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'
                                            }`}>
                                            {tx.status === 'failed' ? <X className="w-4 h-4" /> :
                                                tx.type === 'send' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-foreground">
                                                {tx.type === 'send' ? 'Sent' : 'Received'}
                                            </p>
                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">
                                                {new Date(tx.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold font-mono ${tx.type === 'send' ? 'text-foreground' : 'text-green-500'
                                            }`}>
                                            {tx.type === 'send' ? '-' : '+'}{tx.amount} {tx.denom}
                                        </p>
                                        <p className="text-[10px] text-[var(--text-dim)] uppercase">
                                            {tx.status}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                                        <span className="opacity-50">{tx.type === 'send' ? 'To:' : 'From:'}</span>
                                        <span className="font-mono bg-surface/50 px-1 rounded">{tx.counterparty.slice(0, 8)}...{tx.counterparty.slice(-4)}</span>
                                    </div>
                                    <a
                                        href={`https://explorer.lumen.node9x.com/lumen/tx/${tx.hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] flex items-center gap-1 text-primary hover:text-primary-hover transition-colors"
                                    >
                                        <span>View</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
