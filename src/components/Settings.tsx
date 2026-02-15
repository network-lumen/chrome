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
    const [connectedDApps, setConnectedDApps] = useState<string[]>([]);
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

            // Load connected dApps
            try {
                const result = await chrome.storage.local.get(['connectedOrigins']);
                const origins = (result.connectedOrigins as string[]) || [];
                setConnectedDApps(origins);
            } catch (e) {
            }
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

    const handleDisconnect = async (origin: string) => {
        try {
            const result = await chrome.storage.local.get(['connectedOrigins']);
            const origins = (result.connectedOrigins as string[]) || [];
            const filtered = origins.filter(o => o !== origin);
            await chrome.storage.local.set({ connectedOrigins: filtered });
            setConnectedDApps(filtered);
        } catch (e) {
            console.error('Error disconnecting dApp:', e);
        }
    };

    const extractDomain = (origin: string): string => {
        try {
            const url = new URL(origin);
            return url.hostname;
        } catch {
            return origin;
        }
    };

    return (
        <div className="flex flex-col h-full animate-fade-in relative">
            <header className="flex items-center gap-4 p-4 border-b border-border">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 text-[var(--text-muted)] hover:text-foreground transition-colors rounded-lg hover:bg-surfaceHighlight"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <h2 className="text-lg font-bold text-foreground">Settings</h2>
            </header>

            <div className="p-6 space-y-8">
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
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        <h3 className="font-bold text-sm uppercase tracking-wider">Connected Applications</h3>
                    </div>

                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        Manage applications that have permission to view your account address.
                    </p>

                    <div className="bg-surface rounded-xl border border-border overflow-hidden">
                        {connectedDApps.length === 0 ? (
                            <div className="p-4 text-center text-xs text-[var(--text-dim)]">
                                No applications connected
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {connectedDApps.map((origin) => (
                                    <div key={origin} className="flex items-center justify-between p-3">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded-full bg-surfaceHighlight flex items-center justify-center shrink-0">
                                                <span className="text-xs font-bold text-primary">
                                                    {extractDomain(origin).charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="truncate">
                                                <div className="text-sm font-medium text-foreground truncate">
                                                    {extractDomain(origin)}
                                                </div>
                                                <div className="text-[10px] text-[var(--text-muted)] truncate">
                                                    {origin}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDisconnect(origin)}
                                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-2"
                                            title="Disconnect"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
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
