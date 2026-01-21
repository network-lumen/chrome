import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { SwapApi, type CreateOrderRequest, type QuoteResponse } from '../../modules/swap/api';
import { SwapOrchestrator } from '../../modules/swap/orchestrator';
import { ALLOWLIST_PROVIDERS } from '../../modules/swap/providers';
import type { LumenWallet } from '../../modules/sdk/key-manager';

interface SwapProps {
    walletKeys: LumenWallet;
}

type SwapStep = 'INPUT' | 'REVIEW' | 'PROCESSING' | 'SUCCESS';

export const Swap: React.FC<SwapProps> = ({ walletKeys }) => {
    const [step, setStep] = useState<SwapStep>('INPUT');
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Quote Data
    const [quote, setQuote] = useState<QuoteResponse | null>(null);
    const [providerInfo, setProviderInfo] = useState<any>(null);

    // Status Polling
    const [orderStatus, setOrderStatus] = useState<any>(null); // any to avoid import unused issue if type differs
    const [txHash, setTxHash] = useState<string | null>(null);

    const handleGetQuote = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setError("Invalid amount.");
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Mock Payou Address
            const payoutAddr = "0xMockEthAddress...";

            const req: CreateOrderRequest = {
                fromAsset: 'LMN',
                toAsset: 'USDC',
                fromAmount: amount,
                payout: { chain: 'EVM', address: payoutAddr },
                refund: { addressLumen: walletKeys.address },
                client: { app: 'lumen-ext', version: '1.0' }
            };

            const response = await SwapApi.createOrder(req);

            // Validate immediately
            SwapOrchestrator.validateQuote(response);

            setQuote(response);
            setProviderInfo(ALLOWLIST_PROVIDERS.find(p => p.id === response.providerId));
            setStep('REVIEW');
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to get quote.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!quote) return;
        try {
            setIsLoading(true);
            const hash = await SwapOrchestrator.executeSwap(walletKeys, quote);
            setTxHash(hash);
            setStep('PROCESSING');
        } catch (e: any) {
            console.error(e);
            setError("Swap execution failed: " + e.message);
            setIsLoading(false);
        }
    };

    // Polling Effect for Processing Step
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (step === 'PROCESSING' && quote) {
            interval = setInterval(async () => {
                try {
                    const status = await SwapApi.getOrderStatus(quote.orderId);
                    setOrderStatus(status);
                    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
                        if (status.status === 'COMPLETED') setStep('SUCCESS');
                    }
                } catch (e) { console.error("Polling error", e); }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [step, quote]);

    const renderInput = () => (
        <div className="space-y-6 pt-4">
            <div className="bg-surface rounded-xl p-4 border border-border space-y-2">
                <label className="text-xs text-[var(--text-muted)] font-medium uppercase">You Send</label>
                <div className="flex items-center justify-between">
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="bg-transparent text-2xl font-bold text-foreground outline-none w-full placeholder:text-[var(--text-dim)]"
                    />
                    <div className="flex items-center gap-2 bg-surfaceHighlight px-2 py-1 rounded-lg">
                        <div className="w-5 h-5 rounded-full bg-primary/20"></div>
                        <span className="font-bold text-sm">LMN</span>
                    </div>
                </div>
                <div className="text-xs text-[var(--text-muted)]">Balance: Loading...</div>
            </div>

            <div className="flex justify-center -my-3 relative z-10">
                <div className="bg-background border border-border p-2 rounded-full">
                    <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
            </div>

            <div className="bg-surface rounded-xl p-4 border border-border space-y-2">
                <label className="text-xs text-[var(--text-muted)] font-medium uppercase">You Receive (Est)</label>
                <div className="flex items-center justify-between">
                    <input
                        disabled
                        value={amount ? (parseFloat(amount) * 1.5).toFixed(2) : '0.00'} // Mock rate
                        className="bg-transparent text-2xl font-bold text-[var(--text-muted)] outline-none w-full"
                    />
                    <div className="flex items-center gap-2 bg-surfaceHighlight px-2 py-1 rounded-lg">
                        <div className="w-5 h-5 rounded-full bg-blue-500/20"></div>
                        <span className="font-bold text-sm">USDC</span>
                    </div>
                </div>
            </div>

            <button
                onClick={handleGetQuote}
                disabled={!amount || isLoading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 mt-4"
            >
                {isLoading ? 'Getting Quote...' : 'Review Swap'}
            </button>
        </div>
    );

    const renderReview = () => (
        <div className="space-y-6 pt-4 animate-slide-up">
            <div className="space-y-4">
                <h3 className="text-lg font-bold">Review Order</h3>

                <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-muted)]">Provider</span>
                        <div className="flex items-center gap-1.5">
                            {providerInfo?.icon && <img src={providerInfo.icon} className="w-4 h-4 rounded-full" />}
                            <span className="text-sm font-medium">{providerInfo?.name || quote?.providerId}</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-muted)]">Rate</span>
                        <span className="text-sm font-mono">1 LMN ≈ 1.5 USDC</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-muted)]">Deposit Address</span>
                        <span className="text-xs font-mono text-[var(--text-muted)] truncate max-w-[150px]">{quote?.deposit.address}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-muted)]">Expires In</span>
                        <span className="text-xs font-mono text-orange-500">14:59</span>
                    </div>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                    <p className="text-xs text-blue-500 leading-relaxed">
                        You are sending LMN to a bridge provider. They will release USDC to your destination address.
                    </p>
                </div>
            </div>

            <button
                onClick={handleExecute}
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                    "Confirm Swap"
                )}
            </button>
        </div>
    );

    const renderProcessing = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-6 pt-10 text-center animate-fade-in">
            <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-surfaceHighlight rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>

            <div className="space-y-2">
                <h2 className="text-xl font-bold">Swap in Progress</h2>
                <p className="text-xs text-[var(--text-muted)]">Order ID: {quote?.orderId}</p>
                {txHash && <p className="text-[10px] text-[var(--text-muted)] font-mono break-all bg-surfaceHighlight p-1 rounded">Tx: {txHash}</p>}
            </div>

            <div className="w-full bg-surface border border-border rounded-xl p-4 text-left space-y-4">
                <StatusStep label="Deposit Transaction" status="COMPLETED" />
                <StatusStep label="Deposit Detected" status={orderStatus?.status === 'PENDING_DEPOSIT' ? 'PENDING' : 'COMPLETED'} />
                <StatusStep label="Payout Sent" status={orderStatus?.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING'} />
            </div>

            <p className="text-xs text-[var(--text-muted)]">You can leave this screen. The swap will continue.</p>
        </div>
    );

    const renderSuccess = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-6 pt-10 text-center animate-fade-in">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">
                <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold">Swap Completed!</h2>
            <p className="text-sm text-[var(--text-muted)]">Your USDC has been sent to your destination wallet.</p>
            <button
                onClick={() => setStep('INPUT')}
                className="w-full bg-surface border border-border hover:bg-surfaceHighlight text-foreground font-bold py-3 rounded-xl mt-4"
            >
                Start New Swap
            </button>
        </div>
    );

    return (
        <div className="flex flex-col h-full animate-fade-in relative">
            <header className="flex items-center gap-4 p-4 border-b border-border">
                {step !== 'PROCESSING' && step !== 'SUCCESS' && (
                    <button
                        onClick={() => step === 'INPUT' ? {} : setStep('INPUT')} // In real app, back routing
                        className="p-2 -ml-2 text-[var(--text-muted)] hover:text-foreground transition-colors rounded-lg hover:bg-surfaceHighlight"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}
                <h2 className="text-lg font-bold text-foreground">Swap</h2>
            </header>

            <div className="p-6 flex-1 overflow-y-auto">
                {step === 'INPUT' && renderInput()}
                {step === 'REVIEW' && renderReview()}
                {step === 'PROCESSING' && renderProcessing()}
                {step === 'SUCCESS' && renderSuccess()}

                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-left">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <p className="text-red-500 text-xs">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatusStep = ({ label, status }: { label: string, status: 'PENDING' | 'COMPLETED' }) => (
    <div className="flex items-center gap-3">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${status === 'COMPLETED' ? 'bg-green-500 text-white' : 'bg-surfaceHighlight border border-border'}`}>
            {status === 'COMPLETED' && <CheckCircle className="w-3 h-3" />}
        </div>
        <span className={`text-sm ${status === 'COMPLETED' ? 'text-foreground font-medium' : 'text-[var(--text-muted)]'}`}>{label}</span>
    </div>
);
