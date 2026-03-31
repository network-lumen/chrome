import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookUser } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useSendTransaction } from '../../hooks/useSendTransaction';
import { KeyManager, type LumenWallet } from '../../modules/sdk/key-manager';
import { NetworkManager } from '../../modules/sdk/network';
import {
    enrichIbcChannel,
    fetchIbcChannels,
    getAddressPrefix,
    isProbablyBech32Address,
    type IbcChannelOption
} from '../../modules/sdk/ibc';
import {
    type AssetTransferTarget,
    type CrossChainAssetRow
} from '../../modules/assets/crossChain';
import { ContactsModal } from '../contacts/ContactsModal';
import { HistoryManager } from '../../modules/history/history';

interface SendProps {
    activeKeys: LumenWallet;
    onBack: () => void;
}

type SendMode = 'same-chain' | 'ibc';

interface SendLocationState {
    assetContext?: CrossChainAssetRow;
    initialMode?: SendMode;
}

interface SendTargetOption {
    key: string;
    chainId: string;
    chainLabel: string;
    addressPrefix: string;
    defaultRecipient: string;
    sourceChannel: string;
    sourcePort: string;
    routeLabel: string;
    expectedDestinationDenom: string;
    expectedDestinationTracePath: string;
    expectedDestinationDisplayName: string;
}

function mapChannelToTarget(channel: IbcChannelOption): SendTargetOption {
    return {
        key: `${channel.portId}:${channel.channelId}`,
        chainId: channel.chainId || channel.channelId,
        chainLabel: channel.label || 'Other chain',
        addressPrefix: channel.addressPrefix || channel.prefixHints[0] || '',
        defaultRecipient: '',
        sourceChannel: channel.channelId,
        sourcePort: channel.portId,
        routeLabel: `${channel.portId}/${channel.channelId}`,
        expectedDestinationDenom: channel.expectedDestinationDenom || '',
        expectedDestinationTracePath: channel.expectedDestinationTracePath || '',
        expectedDestinationDisplayName: channel.expectedDestinationDisplayName || ''
    };
}

function mapAssetTransferTarget(target: AssetTransferTarget): SendTargetOption {
    return {
        key: target.key,
        chainId: target.chainId,
        chainLabel: target.chainLabel,
        addressPrefix: target.addressPrefix,
        defaultRecipient: target.defaultRecipient,
        sourceChannel: target.sourceChannel,
        sourcePort: target.sourcePort,
        routeLabel: target.routeLabel,
        expectedDestinationDenom: '',
        expectedDestinationTracePath: '',
        expectedDestinationDisplayName: ''
    };
}

function formatDisplayAmount(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '0';
    return value.toFixed(6).replace(/\.?0+$/, '') || '0';
}

function buildExplorerUrl(chainId: string, txHash: string): string {
    if (String(chainId || '').startsWith('lumen')) {
        return `https://winscan.winsnip.xyz/lumen-mainnet/transactions/${txHash}`;
    }
    return '';
}

async function fetchAssetBalance(restEndpoint: string, ownerAddress: string, denom: string): Promise<number> {
    const base = String(restEndpoint || '').replace(/\/+$/, '');
    const res = await fetch(`${base}/cosmos/bank/v1beta1/balances/${encodeURIComponent(ownerAddress)}`);
    if (!res.ok) {
        throw new Error('Failed to fetch balance');
    }

    const data = await res.json();
    const balances = Array.isArray(data?.balances) ? data.balances : [];
    const coin = balances.find((entry: any) => String(entry?.denom || '').trim() === denom);
    return parseFloat(String(coin?.amount || '0')) / 1_000_000;
}

export const Send: React.FC<SendProps> = ({ activeKeys, onBack }) => {
    const location = useLocation();
    const locationState = (location.state || null) as SendLocationState | null;
    const assetContext = locationState?.assetContext || null;
    const initialMode = locationState?.initialMode;

    const { sendTransaction, ibcTransfer, isLoading, error, successHash, resetState } = useSendTransaction();

    const [mode, setMode] = useState<SendMode>(() => {
        if (initialMode === 'ibc' && (assetContext?.transferEnabled ?? true)) {
            return 'ibc';
        }
        return 'same-chain';
    });
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [memo, setMemo] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [showContacts, setShowContacts] = useState(false);

    const [dynamicIbcChannels, setDynamicIbcChannels] = useState<SendTargetOption[]>([]);
    const [ibcChannelsLoading, setIbcChannelsLoading] = useState(false);
    const [ibcChannelsError, setIbcChannelsError] = useState<string | null>(null);
    const [selectedTargetKey, setSelectedTargetKey] = useState('');
    const [defaultIbcRecipient, setDefaultIbcRecipient] = useState('');
    const [lastAutoRecipient, setLastAutoRecipient] = useState('');

    const [balance, setBalance] = useState<number>(0);
    const [isBalanceLoading, setIsBalanceLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const historySavedHashRef = useRef<string | null>(null);

    const isIbcMode = mode === 'ibc';
    const sourceChainId = assetContext?.chainId || 'lumen';
    const sourceChainLabel = assetContext?.chainLabel || 'Lumen';
    const sourceAddress = assetContext?.ownerAddress || activeKeys.address;
    const sourcePrefix = assetContext?.addressPrefix || getAddressPrefix(sourceAddress) || 'lmn';
    const sourceDenom = assetContext?.denom || 'ulmn';
    const sourceSymbol = assetContext?.displaySymbol || 'LMN';
    const sourceName = assetContext?.displayName || 'Lumen';
    const sourceRestEndpoint = assetContext?.restEndpoint || NetworkManager.getInstance().getQuickRestEndpoint();
    const sourceRpcEndpoint = assetContext?.rpcEndpoint || '';
    const sourceFeeDenom = assetContext?.feeDenom || 'ulmn';
    const sourceMinGasPrice = assetContext?.minGasPrice ?? 0;
    const sourceIsLocal = assetContext?.isLocal ?? true;

    const assetTargets = useMemo(
        () => (assetContext?.transferTargets || []).map((target) => mapAssetTransferTarget(target)),
        [assetContext]
    );
    const availableIbcTargets = assetContext ? assetTargets : dynamicIbcChannels;

    const displayedError = error || localError;
    const showLinkPqcHint = !!displayedError && /account not linked on chain yet|not linked on chain|missing pqc key|pqc signature required/i.test(displayedError);
    const recipientPrefix = getAddressPrefix(recipient);

    const selectedTarget = useMemo(
        () => availableIbcTargets.find((target) => target.key === selectedTargetKey) || null,
        [availableIbcTargets, selectedTargetKey]
    );

    const recipientPlaceholder = isIbcMode
        ? (selectedTarget?.addressPrefix ? `${selectedTarget.addressPrefix}1...` : 'address on the other chain')
        : `${sourcePrefix}1...`;

    const amountLabel = `Amount (${sourceSymbol})`;
    const headerTitle = isIbcMode ? `Transfer ${sourceSymbol} To Other Chain` : `Send ${sourceSymbol}`;
    const successExplorerUrl = successHash ? buildExplorerUrl(sourceChainId, successHash) : '';

    useEffect(() => {
        let cancelled = false;

        const loadBalance = async () => {
            try {
                setIsBalanceLoading(true);
                const nextBalance = await fetchAssetBalance(sourceRestEndpoint, sourceAddress, sourceDenom);
                if (!cancelled) {
                    setBalance(nextBalance);
                }
            } catch (e) {
                if (!cancelled) {
                    console.error('Balance fetch error:', e);
                }
            } finally {
                if (!cancelled) {
                    setIsBalanceLoading(false);
                }
            }
        };

        void loadBalance();
        return () => {
            cancelled = true;
        };
    }, [sourceAddress, sourceDenom, sourceRestEndpoint]);

    useEffect(() => {
        if (!isIbcMode || assetContext || dynamicIbcChannels.length > 0) return;

        let cancelled = false;

        const loadChannels = async () => {
            try {
                setIbcChannelsLoading(true);
                setIbcChannelsError(null);
                const channels = await fetchIbcChannels();
                if (cancelled) return;

                const basicTargets = channels.map((channel) => mapChannelToTarget(channel));
                setDynamicIbcChannels(basicTargets);

                if (!basicTargets.length) {
                    setIbcChannelsError('No route to another chain is available right now.');
                    return;
                }

                void Promise.allSettled(
                    channels.map((channel) => (channel.knownMeta ? Promise.resolve(channel) : enrichIbcChannel(channel)))
                ).then((results) => {
                    if (cancelled) return;

                    const enrichedTargets = results
                        .map((result, index) => result.status === 'fulfilled' ? mapChannelToTarget(result.value) : basicTargets[index])
                        .sort((a, b) => a.chainLabel.localeCompare(b.chainLabel));

                    setDynamicIbcChannels(enrichedTargets);
                });
            } catch (e: any) {
                if (!cancelled) {
                    setDynamicIbcChannels([]);
                    setIbcChannelsError(e?.message || 'Failed to load destinations.');
                }
            } finally {
                if (!cancelled) {
                    setIbcChannelsLoading(false);
                }
            }
        };

        void loadChannels();
        return () => {
            cancelled = true;
        };
    }, [assetContext, dynamicIbcChannels.length, isIbcMode]);

    useEffect(() => {
        if (!isIbcMode) return;

        if (!availableIbcTargets.length) {
            setSelectedTargetKey('');
            return;
        }

        if (selectedTarget) return;

        const ranked = [...availableIbcTargets].sort((a, b) => {
            const scoreA = a.addressPrefix && a.addressPrefix === recipientPrefix ? 100 : 0;
            const scoreB = b.addressPrefix && b.addressPrefix === recipientPrefix ? 100 : 0;
            return scoreB - scoreA || a.chainLabel.localeCompare(b.chainLabel);
        });

        setSelectedTargetKey(ranked[0].key);
    }, [availableIbcTargets, isIbcMode, recipientPrefix, selectedTarget]);

    useEffect(() => {
        if (!isIbcMode || !selectedTarget) {
            setDefaultIbcRecipient('');
            return;
        }

        let cancelled = false;

        const loadDefaultRecipient = async () => {
            try {
                const nextDefaultRecipient = selectedTarget.defaultRecipient
                    || (selectedTarget.addressPrefix
                        ? await KeyManager.deriveAddressWithPrefix(activeKeys.mnemonic, selectedTarget.addressPrefix)
                        : '');

                if (cancelled) return;

                setDefaultIbcRecipient(nextDefaultRecipient);

                const shouldAutofill =
                    !recipient ||
                    recipient === lastAutoRecipient ||
                    recipientPrefix === sourcePrefix;

                if (nextDefaultRecipient && shouldAutofill) {
                    setRecipient(nextDefaultRecipient);
                    setLastAutoRecipient(nextDefaultRecipient);
                }
            } catch {
                if (!cancelled) {
                    setDefaultIbcRecipient('');
                }
            }
        };

        void loadDefaultRecipient();
        return () => {
            cancelled = true;
        };
    }, [activeKeys.mnemonic, isIbcMode, lastAutoRecipient, recipient, recipientPrefix, selectedTarget, sourcePrefix]);

    useEffect(() => {
        if (!assetContext) return;
        if (initialMode === 'ibc' && assetContext.transferEnabled) {
            setMode('ibc');
        }
    }, [assetContext, initialMode]);

    useEffect(() => {
        if (!successHash || historySavedHashRef.current === successHash) return;

        HistoryManager.saveTransaction(activeKeys.address, {
            hash: successHash,
            height: '0',
            timestamp: new Date().toISOString(),
            type: 'send',
            amount,
            denom: sourceSymbol,
            counterparty: recipient,
            status: 'success'
        });
        historySavedHashRef.current = successHash;
    }, [activeKeys.address, amount, isIbcMode, recipient, sourceSymbol, successHash]);

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
        if (isNaN(numAmount) || numAmount <= 0) {
            setLocalError(`Enter a valid ${sourceSymbol} amount.`);
            return;
        }

        if (numAmount > balance) {
            setLocalError(`Insufficient balance. Maximum available: ${formatDisplayAmount(balance)} ${sourceSymbol}`);
            return;
        }

        if (isIbcMode) {
            if (!selectedTarget) {
                setLocalError(ibcChannelsLoading ? 'Destinations are still loading.' : 'Please select another chain.');
                return;
            }

            if (!isProbablyBech32Address(trimmedRecipient)) {
                setLocalError('Invalid destination address format.');
                return;
            }

            if (recipientPrefix === sourcePrefix) {
                setLocalError(`This looks like a ${sourcePrefix.toUpperCase()} address. Use same-chain send instead.`);
                return;
            }

            if (selectedTarget.addressPrefix && recipientPrefix && recipientPrefix !== selectedTarget.addressPrefix) {
                setLocalError(`Recipient must use the ${selectedTarget.addressPrefix} address format for ${selectedTarget.chainLabel}.`);
                return;
            }
        } else if (recipientPrefix !== sourcePrefix) {
            setLocalError(`Recipient must use the ${sourcePrefix.toUpperCase()} address format.`);
            return;
        }

        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        try {
            const targetRecipient = recipient.trim();

            if (isIbcMode) {
                if (!selectedTarget) {
                    throw new Error('Missing destination route.');
                }

                await ibcTransfer(activeKeys, targetRecipient, amount, {
                    memo,
                    sourceChannel: selectedTarget.sourceChannel,
                    sourcePort: selectedTarget.sourcePort,
                    timeoutSeconds: 600,
                    denom: sourceDenom,
                    useStandardTx: !sourceIsLocal,
                    fromAddress: sourceAddress,
                    addressPrefix: sourcePrefix,
                    rpcEndpoint: sourceRpcEndpoint,
                    feeDenom: sourceFeeDenom,
                    minGasPrice: sourceMinGasPrice
                });
            } else {
                await sendTransaction(activeKeys, targetRecipient, amount, memo, {
                    denom: sourceDenom,
                    useStandardTx: !sourceIsLocal,
                    fromAddress: sourceAddress,
                    addressPrefix: sourcePrefix,
                    rpcEndpoint: sourceRpcEndpoint,
                    feeDenom: sourceFeeDenom,
                    minGasPrice: sourceMinGasPrice
                });
            }

            setShowConfirm(false);
        } catch {
            setShowConfirm(false);
        }
    };

    if (successHash) {
        return (
            <div className="flex flex-col h-full animate-fade-in p-6 items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 mb-2">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-foreground">{isIbcMode ? 'Transfer Submitted!' : 'Transaction Sent!'}</h2>
                <div className="bg-surface border border-border rounded-xl p-4 w-full break-all">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold mb-1">Tx Hash</p>
                    {successExplorerUrl ? (
                        <a
                            href={successExplorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-primary hover:underline hover:text-primary-hover transition-all"
                        >
                            {successHash}
                        </a>
                    ) : (
                        <p className="text-xs font-mono text-primary">{successHash}</p>
                    )}
                </div>
                <button
                    onClick={() => {
                        resetState();
                        historySavedHashRef.current = null;
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
        <div className="flex flex-col h-full min-h-0 animate-fade-in relative">
            <header className="flex items-center gap-4 p-4 border-b border-border">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 text-[var(--text-muted)] hover:text-foreground transition-colors rounded-lg hover:bg-surfaceHighlight"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <h2 className="text-lg font-bold text-foreground">{headerTitle}</h2>
            </header>

            <form onSubmit={handleSubmit} className="p-6 pb-24 space-y-6 flex-1 overflow-y-auto">
                {assetContext && (
                    <div className="rounded-2xl border border-border bg-surface p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold text-foreground">{sourceName}</p>
                                <p className="text-[11px] text-[var(--text-muted)]">{sourceChainLabel} · {sourceSymbol}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-foreground">{formatDisplayAmount(balance)} {sourceSymbol}</p>
                                <p className="text-[11px] text-[var(--text-muted)] font-mono">{sourceAddress}</p>
                            </div>
                        </div>
                        {assetContext.traceLabel && (
                            <p className="text-[11px] text-[var(--text-muted)]">{assetContext.traceLabel}</p>
                        )}
                        {assetContext.routeLabel && (
                            <p className="text-[11px] text-[var(--text-muted)]">{assetContext.routeLabel}</p>
                        )}
                    </div>
                )}

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
                        disabled={assetContext ? !assetContext.transferEnabled : false}
                        className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${isIbcMode
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-[var(--text-muted)] hover:text-foreground hover:bg-surfaceHighlight'
                            } ${assetContext && !assetContext.transferEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        To Other Chain
                    </button>
                </div>

                {isIbcMode && (
                    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-[var(--text-muted)]">Other Chain</label>
                            {selectedTarget && (
                                <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                                    {selectedTarget.chainLabel}
                                </span>
                            )}
                        </div>

                        <select
                            value={selectedTargetKey}
                            onChange={(e) => {
                                setSelectedTargetKey(e.target.value);
                                setLocalError(null);
                            }}
                            className="w-full bg-background border border-border rounded-xl p-4 text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            disabled={ibcChannelsLoading || !availableIbcTargets.length}
                        >
                            <option value="">
                                {ibcChannelsLoading ? 'Loading destinations...' : 'Select another chain'}
                            </option>
                            {availableIbcTargets.map((target) => (
                                <option
                                    key={target.key}
                                    value={target.key}
                                >
                                    {target.chainLabel}
                                </option>
                            ))}
                        </select>

                        {selectedTarget && (
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3 space-y-2">
                                <p className="text-[11px] text-[var(--text-muted)]">
                                    Transfer route: <span className="font-mono text-foreground">{selectedTarget.routeLabel}</span>
                                </p>
                                <p className="text-[11px] text-[var(--text-muted)]">
                                    Source chain: <span className="text-foreground font-semibold">{sourceChainLabel}</span>
                                </p>
                                <p className="text-[11px] text-[var(--text-muted)]">
                                    Destination: <span className="text-foreground font-semibold">{selectedTarget.chainLabel}</span>
                                    {selectedTarget.addressPrefix ? ` · ${selectedTarget.addressPrefix}1...` : ''}
                                </p>
                                {selectedTarget.expectedDestinationDisplayName && (
                                    <p className="text-[11px] text-[var(--text-muted)]">
                                        Recipient gets: <span className="text-foreground font-semibold">{selectedTarget.expectedDestinationDisplayName}</span>
                                    </p>
                                )}
                                {selectedTarget.expectedDestinationDenom && (
                                    <p className="text-[11px] text-[var(--text-muted)] break-all">
                                        Expected denom: <span className="font-mono text-foreground">{selectedTarget.expectedDestinationDenom}</span>
                                        {selectedTarget.expectedDestinationTracePath ? ` (${selectedTarget.expectedDestinationTracePath}/${sourceDenom})` : ''}
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
                        {!isIbcMode && sourceIsLocal && (
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
                        <label className="text-xs font-medium text-[var(--text-muted)]">{amountLabel}</label>
                        <button
                            type="button"
                            onClick={() => setAmount(formatDisplayAmount(balance))}
                            className="text-[10px] font-bold text-primary hover:text-primary-hover transition-colors flex items-center gap-1"
                        >
                            MAX: {isBalanceLoading ? '...' : formatDisplayAmount(balance)}
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
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-muted)]">{sourceSymbol}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)] ml-1">Memo (Optional)</label>
                    <input
                        type="text"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        placeholder={isIbcMode ? 'Tx memo / IBC packet memo...' : 'Public note...'}
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
                        disabled={!recipient || !amount || isLoading || (isIbcMode && (!selectedTarget || ibcChannelsLoading))}
                        className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all"
                    >
                        {isIbcMode ? `Review ${sourceSymbol} Transfer` : `Review ${sourceSymbol} Send`}
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
                            <h3 className="text-xl font-bold text-foreground">{isIbcMode ? 'Confirm Transfer To Other Chain' : 'Confirm Send'}</h3>
                            <p className="text-xs text-[var(--text-muted)]">Please review the details below</p>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-1 text-center">
                                <p className="text-[10px] text-primary/60 uppercase font-black tracking-widest">Amount to Send</p>
                                <p className="text-3xl font-black text-primary">{amount} <span className="text-sm font-bold opacity-70">{sourceSymbol}</span></p>
                            </div>

                            <div className="bg-surfaceHighlight/50 p-4 rounded-2xl border border-border/30 space-y-3">
                                <div className="space-y-1.5 text-center">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Source Chain</p>
                                    <p className="text-xs text-foreground">{sourceChainLabel}</p>
                                </div>

                                {isIbcMode && selectedTarget && (
                                    <div className="space-y-1.5 text-center">
                                        <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Transfer Route</p>
                                        <p className="text-xs text-foreground">
                                            {selectedTarget.routeLabel} → {selectedTarget.chainLabel}
                                        </p>
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
