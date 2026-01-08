import React, { useState, useEffect } from 'react';
import { VaultManager } from '../modules/vault/vault';

interface SettingsProps {
    onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const [type, setType] = useState<'minute' | 'hour' | 'day'>('minute');
    const [value, setValue] = useState<number>(5);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const load = async () => {
            const current = await VaultManager.getLockSettings();
            setType(current.type);
            setValue(current.value);
        };
        load();
    }, []);

    const handleSave = async () => {
        await VaultManager.setLockTimeout(type, value);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
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
