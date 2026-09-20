import React, { useState, useEffect } from 'react';
import { VaultManager } from '../modules/vault/vault';
import { NetworkManager, REST_PROVIDERS, RPC_PROVIDERS } from '../modules/sdk/network';

interface SettingsProps {
    onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const [type, setType] = useState<'minute' | 'hour' | 'day'>('minute');
    const [value, setValue] = useState<number>(5);
    const [saved, setSaved] = useState(false);
    const [isAutoRpc, setIsAutoRpc] = useState(true);
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [currentRest, setCurrentRest] = useState('');
    const [currentRpc, setCurrentRpc] = useState('');

    useEffect(() => {
        const load = async () => {
            const current = await VaultManager.getLockSettings();
            setType(current.type);
            setValue(current.value);
            const nm = NetworkManager.getInstance();
            setIsAutoRpc(nm.isAutoMode());
            setSelectedProvider(nm.getSelectedProvider() === 'Auto' ? null : nm.getSelectedProvider());
            setCurrentRest(await nm.getRestEndpoint());
            setCurrentRpc(await nm.getRpcEndpoint());

        };
        load();
    }, []);

    const handleToggleAuto = async () => {
        const next = !isAutoRpc;
        setIsAutoRpc(next);
        const nm = NetworkManager.getInstance();
        if (next) {
            nm.setAuto(true);
            setSelectedProvider(null);
        } else if (selectedProvider) {
            nm.setManualProvider(selectedProvider);
        }
        setCurrentRest(await nm.getRestEndpoint(true));
        setCurrentRpc(await nm.getRpcEndpoint());
    };

    const handleResetDefault = async () => {
        const nm = NetworkManager.getInstance();
        nm.setAuto(true);
        setIsAutoRpc(true);
        setSelectedProvider(null);
        try {
            await chrome.storage.local.remove(['rpc_settings']);
        } catch (e) {
        }
        setCurrentRest(REST_PROVIDERS[0]?.address || '');
        setCurrentRpc(RPC_PROVIDERS[0]?.address || '');
    };

    const handleSave = async () => {
        await VaultManager.setLockTimeout(type, value);

        const nm = NetworkManager.getInstance();
        if (isAutoRpc) {
            nm.setAuto(true);
        } else if (selectedProvider) {
            nm.setManualProvider(selectedProvider);
        }
        await nm.saveSettings();
        setCurrentRest(await nm.getRestEndpoint(true));
        setCurrentRpc(await nm.getRpcEndpoint());

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };



    return (
        <div className="flex flex-col h-full min-h-0 animate-fade-in relative">
            <header className="flex items-center gap-4 p-4 border-b border-border">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 text-[var(--text-muted)] hover:text-foreground transition-colors rounded-lg hover:bg-surfaceHighlight"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <h2 className="text-lg font-bold text-foreground">Settings</h2>
            </header>

            <div className="flex-1 overflow-y-auto p-6 pb-24 space-y-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        <h3 className="font-bold text-sm uppercase tracking-wider">Auto-Lock Timer</h3>
                    </div>

                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        Your wallet will automatically lock after being idle for this duration.
                    </p>

                    <div className="bg-surface rounded-xl p-4 border border-border space-y-4">
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                min="1"
                                value={value}
                                onChange={(e) => setValue(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-20 bg-surfaceHighlight border border-border rounded-lg p-2 text-center text-foreground font-mono focus:border-primary outline-none transition-colors"
                            />
                            <div className="flex bg-surfaceHighlight rounded-lg p-1 border border-border transition-colors">
                                <button
                                    onClick={() => setType('minute')}
                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${type === 'minute' ? 'bg-primary text-white shadow' : 'text-[var(--text-muted)] hover:text-foreground'}`}
                                >
                                    Minutes
                                </button>
                                <button
                                    onClick={() => setType('hour')}
                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${type === 'hour' ? 'bg-primary text-white shadow' : 'text-[var(--text-muted)] hover:text-foreground'}`}
                                >
                                    Hours
                                </button>
                                <button
                                    onClick={() => setType('day')}
                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${type === 'day' ? 'bg-primary text-white shadow' : 'text-[var(--text-muted)] hover:text-foreground'}`}
                                >
                                    Days
                                </button>
                            </div>
                        </div>

                        <div className="text-[10px] text-[var(--text-dim)] font-mono">
                            Auto-lock after: <span className="text-foreground">{value} {type}(s)</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                        <h3 className="font-bold text-sm uppercase tracking-wider">Network Settings</h3>
                    </div>

                    <div className="bg-surface rounded-xl p-4 border border-border space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">Automatic RPC Selection</span>
                            <button
                                onClick={handleToggleAuto}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isAutoRpc ? 'bg-primary' : 'bg-surfaceHighlight'}`}
                            >
                                <span
                                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isAutoRpc ? 'translate-x-5' : 'translate-x-1'}`}
                                />
                            </button>
                        </div>

                        {!isAutoRpc && (
                            <div className="space-y-2 animate-fade-in shadow-sm">
                                <label className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-tight">Select Provider</label>
                                <select
                                    value={selectedProvider || ''}
                                    onChange={(e) => setSelectedProvider(e.target.value)}
                                    className="w-full bg-surfaceHighlight border border-border rounded-lg p-2 text-xs text-foreground outline-none focus:border-primary transition-colors cursor-pointer"
                                >
                                    <option value="" disabled>Choose a provider</option>
                                    {REST_PROVIDERS.map(p => (
                                        <option key={p.provider} value={p.provider}>{p.provider}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="pt-2 border-t border-border/50">
                            <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-tight mb-1">Active RPC Endpoint</div>
                            <div className="text-[10px] font-mono text-primary truncate bg-primary/5 p-2 rounded-lg border border-primary/10">
                                {currentRpc || RPC_PROVIDERS[0]?.address || 'Resolving...'}
                            </div>
                            <div className="mt-2 text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-tight mb-1">Active REST Endpoint</div>
                            <div className="text-[10px] font-mono text-primary truncate bg-primary/5 p-2 rounded-lg border border-primary/10">
                                {currentRest || REST_PROVIDERS[0]?.address || 'Resolving...'}
                            </div>
                            <button
                                onClick={handleResetDefault}
                                className="mt-3 w-full text-[11px] font-semibold text-primary border border-primary/20 rounded-lg py-2 hover:bg-primary/10 transition-colors"
                            >
                                Reset to Cosmos Directory
                            </button>
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleSave}
                        disabled={saved}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${saved ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-hover text-white'}`}
                    >
                        {saved ? 'Saved!' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};
