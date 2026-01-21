import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

    // Sort transactions by timestamp (newest first) and filter
    const filtered = transactions
        .filter(t => filter === 'all' || (filter === 'sent' ? t.type === 'send' : t.type === 'receive'))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose} style={{ margin: 0, left: 0, right: 0, top: 0, bottom: 0 }}>
            <div className="w-full max-w-md h-[85vh] bg-surface border border-border rounded-xl flex flex-col relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface z-10 shrink-0">
                    <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Transaction History
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-surfaceHighlight rounded-lg transition-colors text-[var(--text-muted)] hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-2 flex gap-1 bg-background/50 shrink-0">
                    {(['all', 'sent', 'received'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${filter === f
                                ? 'bg-primary text-white'
                                : 'text-[var(--text-muted)] hover:bg-surfaceHighlight hover:text-foreground'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2">
                            <div className="w-14 h-14 bg-surfaceHighlight rounded-full flex items-center justify-center">
                                <Clock className="w-7 h-7 opacity-30" />
                            </div>
                            <p className="text-xs font-medium">No transactions found</p>
                            <p className="text-[10px] text-[var(--text-dim)]">Your transaction history will appear here</p>
                        </div>
                    ) : (
                        filtered.map((tx) => (
                            <div key={tx.hash} className="group bg-background hover:bg-surfaceHighlight border border-border rounded-lg p-3 transition-colors cursor-default">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                                            tx.type === 'send' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'
                                            }`}>
                                            {tx.status === 'failed' ? <X className="w-4 h-4" /> :
                                                tx.type === 'send' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-foreground capitalize">
                                                {tx.type === 'send' ? 'Sent' : 'Received'}
                                            </p>
                                            <p className="text-[10px] text-[var(--text-muted)]">
                                                {new Date(tx.timestamp).toLocaleString('en-US', {
                                                    month: 'numeric',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-semibold font-mono ${tx.type === 'send' ? 'text-foreground' : 'text-green-500'
                                            }`}>
                                            {tx.type === 'send' ? '-' : '+'}{tx.amount} {tx.denom}
                                        </p>
                                        <p className={`text-[9px] font-semibold uppercase ${tx.status === 'success' ? 'text-green-500' : tx.status === 'failed' ? 'text-red-500' : 'text-yellow-500'
                                            }`}>
                                            {tx.status}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                                        <span className="font-medium">{tx.type === 'send' ? 'To:' : 'From:'}</span>
                                        <span className="font-mono bg-surfaceHighlight px-1.5 py-0.5 rounded">{tx.counterparty.slice(0, 10)}...{tx.counterparty.slice(-6)}</span>
                                    </div>
                                    {tx.hash.startsWith('detected-') || tx.hash.startsWith('sys-') ? (
                                        <a
                                            href={`https://winscan.winsnip.xyz/lumen-mainnet/blocks/${tx.height}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[10px] flex items-center gap-0.5 text-primary hover:text-primary-hover transition-colors font-medium"
                                        >
                                            View
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    ) : tx.hash.startsWith('offline-') ? (
                                        <span className="text-[10px] flex items-center gap-0.5 text-[var(--text-dim)] cursor-help" title="Transaction not found in recent blocks">
                                            <span>Unindexed</span>
                                        </span>
                                    ) : (
                                        <a
                                            href={`https://winscan.winsnip.xyz/lumen-mainnet/transactions/${tx.hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] flex items-center gap-0.5 text-primary hover:text-primary-hover transition-colors font-medium"
                                        >
                                            View
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

    return createPortal(modalContent, document.body);
};
