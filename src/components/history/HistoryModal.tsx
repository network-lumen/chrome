import React, { useState, useEffect } from 'react';
import { HistoryManager, type Transaction } from '../../modules/history/history';
import { Clock, X, ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react';

interface HistoryModalProps {
    address: string;
    onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ address, onClose }) => {
    // 1. Load initial cache
    const [transactions, setTransactions] = useState<Transaction[]>(() => HistoryManager.getHistory(address));
    const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');

    useEffect(() => {
        setTransactions(HistoryManager.getHistory(address));

        // Poll for updates (e.g. from BalanceWatcher)
        const interval = setInterval(() => {
            setTransactions(HistoryManager.getHistory(address));
        }, 2000);

        return () => clearInterval(interval);
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
                    {filtered.length === 0 ? (
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
                                    {tx.hash.startsWith('detected-') || tx.hash.startsWith('sys-') ? (
                                        <a
                                            href={`https://winscan.winsnip.xyz/lumen-mainnet/blocks/${tx.height}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[10px] flex items-center gap-1 text-primary hover:underline"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            System Event #{tx.height}
                                        </a>
                                    ) : tx.hash.startsWith('offline-') ? (
                                        <span className="text-[10px] flex items-center gap-1 text-[var(--text-muted)] cursor-help" title="Transaction not found in recent blocks">
                                            <span>Unindexed</span>
                                        </span>
                                    ) : (
                                        <a
                                            href={`https://winscan.winsnip.xyz/lumen-mainnet/transactions/${tx.hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] flex items-center gap-1 text-primary hover:text-primary-hover transition-colors"
                                        >
                                            <span>View</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
