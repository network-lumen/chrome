import React, { useState } from 'react';
import { useSendTransaction } from '../../hooks/useSendTransaction';
import type { LumenWallet } from '../../modules/sdk/key-manager';
import { BookUser } from 'lucide-react';
import { ContactsModal } from '../contacts/ContactsModal';
import { HistoryManager } from '../../modules/history/history';

interface SendProps {
    activeKeys: LumenWallet;
    onBack: () => void;
}

export const Send: React.FC<SendProps> = ({ activeKeys, onBack }) => {
    const { sendTransaction, isLoading, error, successHash, resetState } = useSendTransaction();

    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [memo, setMemo] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [showContacts, setShowContacts] = useState(false);

    // Balance State
    const [balance, setBalance] = useState<number>(0);
    const [isBalanceLoading, setIsBalanceLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Fetch Balance
    React.useEffect(() => {
        const fetchBalance = async () => {
            try {
                setIsBalanceLoading(true);
                const API_URL = "https://api-lumen.winnode.xyz";
                const res = await fetch(`${API_URL}/cosmos/bank/v1beta1/balances/${activeKeys.address}`);
                if (!res.ok) throw new Error("Failed to fetch balance");
                const data = await res.json();
                const ulmn = data.balances?.find((b: any) => b.denom === 'ulmn');
                if (ulmn) {
                    setBalance(parseFloat(ulmn.amount) / 1_000_000);
                }
            } catch (e) {
                console.error("Balance fetch error:", e);
            } finally {
                setIsBalanceLoading(false);
            }
        };

        fetchBalance();
    }, [activeKeys.address]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        if (!recipient || !amount) return;

        const numAmount = parseFloat(amount);

        // Validation
        if (numAmount < 0.001) {
            setLocalError("Minimum transfer is 0.001 LMN");
            return;
        }

        if (numAmount > balance) {
            setLocalError(`Insufficient balance. Maximum available: ${balance.toFixed(6)} LMN`);
            return;
        }

        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        try {
            await sendTransaction(activeKeys, recipient, amount, memo);
            setShowConfirm(false);
        } catch (e) {
            // Error is handled by hook state
            setShowConfirm(false);
        }
    };

    if (successHash) {
        // Save to local history immediately
        HistoryManager.saveTransaction(activeKeys.address, {
            hash: successHash,
            height: '0', // Pending/Unknown
            timestamp: new Date().toISOString(),
            type: 'send',
            amount: amount,
            denom: 'LMN',
            counterparty: recipient,
            status: 'success'
        });

        return (
            <div className="flex flex-col h-full animate-fade-in p-6 items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 mb-2">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-foreground">Transaction Sent!</h2>
                <div className="bg-surface border border-border rounded-xl p-4 w-full break-all">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold mb-1">Tx Hash</p>
                    <a
                        href={`https://winscan.winsnip.xyz/lumen-mainnet/transactions/${successHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-primary hover:underline hover:text-primary-hover transition-all"
                    >
                        {successHash}
                    </a>
                </div>
                <button
                    onClick={() => {
                        resetState();
                        setRecipient('');
                        setAmount('');
                        setMemo('');
                        onBack();
                    }}
                    className="w-full bg-surface border border-border hover:bg-surfaceHighlight text-foreground font-bold py-3.5 rounded-xl transition-all"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in relative">
            <header className="flex items-center gap-4 p-4 border-b border-border">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 text-[var(--text-muted)] hover:text-foreground transition-colors rounded-lg hover:bg-surfaceHighlight"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <h2 className="text-lg font-bold text-foreground">Send LMN</h2>
            </header>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                        <label className="text-xs font-medium text-[var(--text-muted)]">Recipient Address</label>
                        <button
                            type="button"
                            onClick={() => setShowContacts(true)}
                            className="text-[10px] text-primary hover:text-primary-hover font-bold flex items-center gap-1 transition-colors"
                        >
                            <BookUser className="w-3 h-3" />
                            Contacts
                        </button>
                    </div>
                    <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder="lmn1..."
                        className="w-full bg-surface border border-border rounded-xl p-4 text-foreground text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-[var(--text-dim)]"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-medium text-[var(--text-muted)]">Amount (LMN)</label>
                        <button
                            type="button"
                            onClick={() => setAmount(balance.toString())}
                            className="text-[10px] font-bold text-primary hover:text-primary-hover transition-colors flex items-center gap-1"
                        >
                            MAX: {isBalanceLoading ? '...' : balance.toFixed(6)}
                        </button>
                    </div>
                    <div className="relative">
                        <input
                            type="number"
                            step="0.000001"
                            value={amount}
                            onChange={(e) => {
                                setAmount(e.target.value);
                                setLocalError(null);
                            }}
                            placeholder="0.00"
                            className="w-full bg-surface border border-border rounded-xl p-4 text-foreground text-lg font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-[var(--text-dim)]"
                            required
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-muted)]">LMN</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)] ml-1">Memo (Optional)</label>
                    <input
                        type="text"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        placeholder="Public note..."
                        className="w-full bg-surface border border-border rounded-xl p-4 text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-[var(--text-dim)]"
                    />
                </div>

                {(error || localError) && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-red-500 text-xs">{error || localError}</p>
                    </div>
                )}

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={!recipient || !amount || isLoading}
                        className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary/20"
                    >
                        Review Transaction
                    </button>
                </div>
            </form>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
                    <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-slide-up space-y-6">
                        <h3 className="text-lg font-bold text-foreground">Confirm Transfer</h3>

                        <div className="space-y-4">
                            <div className="bg-surfaceHighlight p-4 rounded-xl border border-border space-y-1">
                                <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Sending</p>
                                <p className="text-xl font-bold text-foreground">{amount} LMN</p>
                            </div>

                            <div className="space-y-1">
                                <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">To</p>
                                <p className="text-xs font-mono text-foreground break-all bg-surfaceHighlight p-2 rounded-lg border border-border">{recipient}</p>
                            </div>

                            {memo && (
                                <div className="space-y-1">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Memo</p>
                                    <p className="text-xs text-foreground bg-surfaceHighlight p-2 rounded-lg border border-border">{memo}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-3 rounded-xl font-bold text-foreground bg-surfaceHighlight hover:bg-border transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isLoading}
                                className="flex-1 py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary-hover transition-colors text-sm flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        Sign & Send
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showContacts && (
                <ContactsModal
                    onClose={() => setShowContacts(false)}
                    onSelect={(addr) => {
                        setRecipient(addr);
                        setShowContacts(false);
                    }}
                />
            )}
        </div>
    );
};
