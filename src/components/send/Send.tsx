import React, { useEffect, useState } from 'react';
import { BookUser } from 'lucide-react';
import { useSendTransaction } from '../../hooks/useSendTransaction';
import { KeyManager, type LumenWallet } from '../../modules/sdk/key-manager';
import { NetworkManager } from '../../modules/sdk/network';
import {
    enrichIbcChannel,
    fetchIbcChannels,
    getAddressPrefix,
    isProbablyBech32Address,
    scoreIbcChannel,
    type IbcChannelOption
} from '../../modules/sdk/ibc';
import { ContactsModal } from '../contacts/ContactsModal';
import { HistoryManager } from '../../modules/history/history';

interface SendProps {
    activeKeys: LumenWallet;
    onBack: () => void;
}

type SendMode = 'same-chain' | 'ibc';

export const Send: React.FC<SendProps> = ({ activeKeys, onBack }) => {
    const { sendTransaction, ibcTransfer, isLoading, error, successHash, resetState } = useSendTransaction();

    const [mode, setMode] = useState<SendMode>('same-chain');
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [memo, setMemo] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [showContacts, setShowContacts] = useState(false);

    const [ibcChannels, setIbcChannels] = useState<IbcChannelOption[]>([]);
    const [ibcChannelsLoading, setIbcChannelsLoading] = useState(false);
    const [ibcChannelsError, setIbcChannelsError] = useState<string | null>(null);
    const [selectedChannelId, setSelectedChannelId] = useState('');
    const [selectedPortId, setSelectedPortId] = useState('transfer');
    const [defaultIbcRecipient, setDefaultIbcRecipient] = useState('');
    const [lastAutoRecipient, setLastAutoRecipient] = useState('');

    const [balance, setBalance] = useState<number>(0);
    const [isBalanceLoading, setIsBalanceLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const displayedError = error || localError;
    const showLinkPqcHint = !!displayedError && /account not linked on chain yet|not linked on chain|missing pqc key|pqc signature required/i.test(displayedError);

    const senderPrefix = getAddressPrefix(activeKeys.address) || 'lmn';
    const isIbcMode = mode === 'ibc';
    const recipientPrefix = getAddressPrefix(recipient);
    const selectedIbcChannel = ibcChannels.find(
        (channel) => channel.channelId === selectedChannelId && channel.portId === selectedPortId
    ) || null;
    const selectedIbcPrefix = selectedIbcChannel?.addressPrefix || selectedIbcChannel?.prefixHints[0] || '';
    const selectedIbcLabel = selectedIbcChannel?.label || 'Other chain';
    const selectedIbcExpectedAssetLabel = selectedIbcChannel?.expectedDestinationDisplayName || '';
    const selectedIbcExpectedDenom = selectedIbcChannel?.expectedDestinationDenom || '';
    const selectedIbcExpectedTrace = selectedIbcChannel?.expectedDestinationTracePath || '';
    const recipientPlaceholder = isIbcMode
        ? (selectedIbcPrefix ? `${selectedIbcPrefix}1...` : 'address on the other chain')
        : `${senderPrefix}1...`;

    useEffect(() => {
        const fetchBalance = async () => {
            try {
                setIsBalanceLoading(true);
                const endpoint = NetworkManager.getInstance().getQuickRestEndpoint();
                const res = await fetch(`${endpoint}/cosmos/bank/v1beta1/balances/${activeKeys.address}`);
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

    useEffect(() => {
        if (!isIbcMode || ibcChannels.length > 0) return;

        let cancelled = false;

        const loadChannels = async () => {
            try {
                setIbcChannelsLoading(true);
                setIbcChannelsError(null);
                const channels = await fetchIbcChannels();
                if (cancelled) return;

                setIbcChannels(channels);
                if (!channels.length) {
                    setIbcChannelsError('No route to another chain is available right now.');
                } else {
                    setIbcChannelsLoading(false);

                    void Promise.allSettled(
                        channels.map((channel) => (channel.knownMeta ? Promise.resolve(channel) : enrichIbcChannel(channel)))
                    ).then((results) => {
                        if (cancelled) return;

                        const enriched = results
                            .map((result, index) => result.status === 'fulfilled' ? result.value : channels[index])
                            .sort((a, b) => a.label.localeCompare(b.label));

                        setIbcChannels(enriched);
                    });

                    return;
                }
            } catch (e: any) {
                if (cancelled) return;
                setIbcChannels([]);
                setIbcChannelsError(e?.message || 'Failed to load destinations.');
            } finally {
                if (!cancelled) {
                    setIbcChannelsLoading(false);
                }
            }
        };

        loadChannels();

        return () => {
            cancelled = true;
        };
    }, [ibcChannels.length, isIbcMode]);

    useEffect(() => {
        if (!isIbcMode || !ibcChannels.length) return;
        if (selectedIbcChannel) return;

        const ranked = [...ibcChannels]
            .map((channel) => ({ channel, score: scoreIbcChannel(channel, recipientPrefix) }))
            .sort((a, b) => b.score - a.score || a.channel.label.localeCompare(b.channel.label));

        const next = ranked[0]?.channel || ibcChannels[0];
        if (!next) return;

        setSelectedChannelId(next.channelId);
        setSelectedPortId(next.portId);
    }, [ibcChannels, isIbcMode, recipientPrefix, selectedIbcChannel]);

    useEffect(() => {
        if (!isIbcMode || !selectedIbcPrefix) {
            setDefaultIbcRecipient('');
            return;
        }

        let cancelled = false;

        const deriveRecipient = async () => {
            try {
                const derived = await KeyManager.deriveAddressWithPrefix(activeKeys.mnemonic, selectedIbcPrefix);
                if (cancelled) return;

                setDefaultIbcRecipient(derived);

                const shouldAutofill =
                    !recipient ||
                    recipient === lastAutoRecipient ||
                    recipientPrefix === senderPrefix;

                if (shouldAutofill) {
                    setRecipient(derived);
                    setLastAutoRecipient(derived);
                }
            } catch {
                if (!cancelled) {
                    setDefaultIbcRecipient('');
                }
            }
        };

        deriveRecipient();

        return () => {
            cancelled = true;
        };
    }, [
        activeKeys.mnemonic,
        isIbcMode,
        lastAutoRecipient,
        recipient,
        recipientPrefix,
        selectedIbcPrefix,
        senderPrefix
    ]);

    const handleModeChange = (nextMode: SendMode) => {
        setMode(nextMode);
        setLocalError(null);
        resetState();
        setShowConfirm(false);
        setShowContacts(false);

        if (nextMode === 'ibc') {
            setIbcChannelsError(null);
        }

        if (nextMode === 'same-chain' && recipient === lastAutoRecipient) {
            setRecipient('');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        const trimmedRecipient = recipient.trim();
        if (!trimmedRecipient || !amount) return;

        const numAmount = parseFloat(amount);

        if (numAmount < 0.001) {
            setLocalError("Minimum transfer is 0.001 LMN");
            return;
        }

        if (numAmount > balance) {
            setLocalError(`Insufficient balance. Maximum available: ${balance.toFixed(6)} LMN`);
            return;
        }

        if (isIbcMode) {
            if (!selectedIbcChannel) {
                setLocalError(ibcChannelsLoading ? 'Destinations are still loading.' : 'Please select another chain.');
                return;
            }

            if (!isProbablyBech32Address(trimmedRecipient)) {
                setLocalError('Invalid destination address format.');
                return;
            }

            if (recipientPrefix === senderPrefix) {
                setLocalError(`This looks like a ${senderPrefix.toUpperCase()} address. Use same-chain send instead.`);
                return;
            }

            if (selectedIbcPrefix && recipientPrefix && recipientPrefix !== selectedIbcPrefix) {
                setLocalError(`Recipient must use the ${selectedIbcPrefix} address format for the other chain.`);
                return;
            }
        } else if (recipientPrefix !== senderPrefix) {
            setLocalError(`Recipient must use the ${senderPrefix} address format.`);
            return;
        }

        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        try {
            const targetRecipient = recipient.trim();

            if (isIbcMode) {
                if (!selectedIbcChannel) {
                    throw new Error('Missing destination route.');
                }

                await ibcTransfer(activeKeys, targetRecipient, amount, {
                    memo,
                    sourceChannel: selectedIbcChannel.channelId,
                    sourcePort: selectedIbcChannel.portId,
                    timeoutSeconds: 600
                });
            } else {
                await sendTransaction(activeKeys, targetRecipient, amount, memo);
            }

            setShowConfirm(false);
        } catch {
            setShowConfirm(false);
        }
    };

    if (successHash) {
        HistoryManager.saveTransaction(activeKeys.address, {
            hash: successHash,
            height: '0',
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
                <h2 className="text-2xl font-bold text-foreground">{isIbcMode ? 'Transfer Submitted!' : 'Transaction Sent!'}</h2>
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
                <h2 className="text-lg font-bold text-foreground">{isIbcMode ? 'Transfer To Other Chain' : 'Send LMN'}</h2>
            </header>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface p-1 border border-border">
                    <button
                        type="button"
                        onClick={() => handleModeChange('same-chain')}
                        className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${!isIbcMode
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-[var(--text-muted)] hover:text-foreground hover:bg-surfaceHighlight'
                            }`}
                    >
                        Same-chain
                    </button>
                    <button
                        type="button"
                        onClick={() => handleModeChange('ibc')}
                        className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${isIbcMode
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-[var(--text-muted)] hover:text-foreground hover:bg-surfaceHighlight'
                            }`}
                    >
                        To Other Chain
                    </button>
                </div>

                {isIbcMode && (
                    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-[var(--text-muted)]">Other Chain</label>
                            {selectedIbcChannel && (
                                <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                                    {selectedIbcLabel}
                                </span>
                            )}
                        </div>

                        <select
                            value={selectedChannelId ? `${selectedPortId}:${selectedChannelId}` : ''}
                            onChange={(e) => {
                                const [portId, channelId] = e.target.value.split(':');
                                setSelectedPortId(portId || 'transfer');
                                setSelectedChannelId(channelId || '');
                                setLocalError(null);
                            }}
                            className="w-full bg-background border border-border rounded-xl p-4 text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            disabled={ibcChannelsLoading || !ibcChannels.length}
                        >
                            <option value="">
                                {ibcChannelsLoading ? 'Loading destinations...' : 'Select another chain'}
                            </option>
                            {ibcChannels.map((channel) => (
                                <option
                                    key={`${channel.portId}:${channel.channelId}`}
                                    value={`${channel.portId}:${channel.channelId}`}
                                >
                                    {channel.label}
                                </option>
                            ))}
                        </select>

                        {selectedIbcChannel && (
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3 space-y-2">
                                <p className="text-[11px] text-[var(--text-muted)]">
                                    Route from Lumen: <span className="font-mono text-foreground">{selectedIbcChannel.portId}/{selectedIbcChannel.channelId}</span>
                                </p>
                                <p className="text-[11px] text-[var(--text-muted)]">
                                    Other chain: <span className="text-foreground font-semibold">{selectedIbcLabel}</span>
                                    {selectedIbcPrefix ? ` · ${selectedIbcPrefix}1...` : ''}
                                </p>
                                {selectedIbcExpectedAssetLabel && (
                                    <p className="text-[11px] text-[var(--text-muted)]">
                                        Recipient gets on the other chain: <span className="text-foreground font-semibold">{selectedIbcExpectedAssetLabel}</span>
                                    </p>
                                )}
                                {selectedIbcExpectedDenom && (
                                    <p className="text-[11px] text-[var(--text-muted)] break-all">
                                        Expected denom: <span className="font-mono text-foreground">{selectedIbcExpectedDenom}</span>
                                        {selectedIbcExpectedTrace ? ` (${selectedIbcExpectedTrace}/ulmn)` : ''}
                                    </p>
                                )}
                                {defaultIbcRecipient && (
                                    <div className="flex items-center justify-between gap-3 pt-1">
                                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                                            Your wallet on the other chain: <span className="font-mono text-foreground">{defaultIbcRecipient}</span>
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRecipient(defaultIbcRecipient);
                                                setLastAutoRecipient(defaultIbcRecipient);
                                                setLocalError(null);
                                            }}
                                            className="shrink-0 text-[10px] font-bold text-primary hover:text-primary-hover transition-colors"
                                        >
                                            Use mine
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {ibcChannelsError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <p className="text-red-500 text-xs">{ibcChannelsError}</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                        <label className="text-xs font-medium text-[var(--text-muted)]">
                            {isIbcMode ? 'Recipient on Other Chain' : 'Recipient Address'}
                        </label>
                        {!isIbcMode && (
                            <button
                                type="button"
                                onClick={() => setShowContacts(true)}
                                className="text-[10px] text-primary hover:text-primary-hover font-bold flex items-center gap-1 transition-colors"
                            >
                                <BookUser className="w-3 h-3" />
                                Contacts
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        value={recipient}
                        onChange={(e) => {
                            setRecipient(e.target.value);
                            setLocalError(null);
                        }}
                        placeholder={recipientPlaceholder}
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
                        placeholder={isIbcMode ? 'Optional memo for this transfer...' : 'Public note...'}
                        className="w-full bg-surface border border-border rounded-xl p-4 text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-[var(--text-dim)]"
                    />
                </div>

                {displayedError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-red-500 text-xs">{displayedError}</p>
                        {showLinkPqcHint && (
                            <p className="mt-2 text-[11px] text-red-300 leading-relaxed">
                                Hint: open wallet settings and tap <span className="font-semibold text-red-200">Link PQC Account</span> to register your post-quantum-resistant keys on-chain, then retry.
                            </p>
                        )}
                    </div>
                )}

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={!recipient || !amount || isLoading || (isIbcMode && (!selectedIbcChannel || ibcChannelsLoading))}
                        className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all"
                    >
                        {isIbcMode ? 'Review Transfer To Other Chain' : 'Review Transaction'}
                    </button>
                </div>
            </form>

            {showConfirm && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-surface/90 border border-border/50 rounded-[32px] w-full max-w-[340px] p-6 animate-zoom-in space-y-6 shadow-2xl shadow-black/40">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-2">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-foreground">{isIbcMode ? 'Confirm Transfer To Other Chain' : 'Confirm Transfer'}</h3>
                            <p className="text-xs text-[var(--text-muted)]">Please review the details below</p>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-1 text-center">
                                <p className="text-[10px] text-primary/60 uppercase font-black tracking-widest">Amount to Send</p>
                                <p className="text-3xl font-black text-primary">{amount} <span className="text-sm font-bold opacity-70">LMN</span></p>
                            </div>

                            <div className="bg-surfaceHighlight/50 p-4 rounded-2xl border border-border/30 space-y-3">
                                {isIbcMode && selectedIbcChannel && (
                                    <div className="space-y-1.5 text-center">
                                        <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Transfer Route</p>
                                        <p className="text-xs text-foreground">
                                            {selectedIbcChannel.portId}/{selectedIbcChannel.channelId} → {selectedIbcLabel}
                                        </p>
                                        {selectedIbcExpectedAssetLabel && (
                                            <p className="text-[11px] text-[var(--text-muted)]">
                                                Recipient gets {selectedIbcExpectedAssetLabel}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-1.5 text-center">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Recipient Address</p>
                                    <p className="text-[11px] font-mono text-foreground break-all leading-tight px-2">{recipient}</p>
                                </div>

                                {memo && (
                                    <div className="pt-3 border-t border-border/10 space-y-1 text-center">
                                        <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Memo</p>
                                        <p className="text-xs text-foreground italic">"{memo}"</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleConfirm}
                                disabled={isLoading}
                                className="w-full py-4 rounded-2xl font-bold text-white bg-primary hover:bg-primary-hover active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                            >
                                {isLoading ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        {isIbcMode ? 'Sign & Transfer' : 'Sign & Send'}
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="w-full py-3.5 rounded-2xl font-bold text-[var(--text-muted)] hover:text-foreground hover:bg-surfaceHighlight transition-all text-sm bg-transparent"
                            >
                                Cancel
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
