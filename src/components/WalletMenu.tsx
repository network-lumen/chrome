import React, { useState } from 'react';
import type { LumenWallet } from '../modules/sdk/key-manager';

interface WalletMenuProps {
    wallets: LumenWallet[];
    activeWalletIndex: number;
    activeWalletName: string;
    onSwitch: (index: number) => void;
    onAdd: () => void;
    onLock: () => void;
    onSettings: () => void;
    onRename: (index: number, newName: string) => void;
    onBackup: (index: number) => void;
    onLinkPqc?: () => void;
    onDelete?: (address: string) => void;
}

export const WalletMenu: React.FC<WalletMenuProps> = ({
    wallets,
    activeWalletIndex,
    activeWalletName,
    onSwitch,
    onAdd,
    onLock,
    onSettings,
    onRename,
    onBackup,
    onLinkPqc,
    onDelete
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    const startEdit = (e: React.MouseEvent, idx: number, currentName: string) => {
        e.stopPropagation();
        setEditingIdx(idx);
        setEditName(currentName);
    };

    const saveEdit = (e: React.FormEvent, idx: number) => {
        e.preventDefault();
        onRename(idx, editName.trim() || `Wallet ${idx + 1}`);
        setEditingIdx(null);
    };

    return (
        <div className="relative">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-surfaceHighlight transition-all group cursor-pointer"
                title="Wallet Settings"
            >
                <div className="flex flex-col items-end mr-1">
                    <span className="text-xs font-bold text-foreground tracking-wide">{activeWalletName}</span>
                    <span className="text-[9px] text-green-400 font-medium tracking-wider">Connected</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
                    <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
            </div>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[99998]" onClick={() => { setIsOpen(false); setEditingIdx(null); }}></div>
                    <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border rounded-xl z-[99999] animate-fade-in overflow-hidden">
                        <div className="p-3 border-b border-border flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest">Wallets</span>
                            <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-mono">{wallets.length} Active</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {wallets.map((w, idx) => (
                                <div key={w.address} className="relative group/item">
                                    {editingIdx === idx ? (
                                        <form onSubmit={(e) => saveEdit(e, idx)} className="p-2 bg-surfaceHighlight">
                                            <input
                                                autoFocus
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onBlur={(e) => saveEdit(e as any, idx)}
                                                className="w-full bg-background border border-primary rounded px-2 py-1 text-xs text-foreground outline-none"
                                            />
                                        </form>
                                    ) : (
                                        <div
                                            onClick={() => {
                                                onSwitch(idx);
                                                setIsOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-3 hover:bg-surfaceHighlight flex items-center gap-3 group transition-colors border-l-2 cursor-pointer ${idx === activeWalletIndex
                                                ? 'border-green-500 bg-green-500/5'
                                                : 'border-transparent hover:border-primary'
                                                }`}
                                        >
                                            {/* Checkmark (Left) */}
                                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                                {idx === activeWalletIndex ? (
                                                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                ) : (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-surface border border-border group-hover:bg-primary/50 transition-colors"></div>
                                                )}
                                            </div>

                                            <div className="flex flex-col overflow-hidden flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold truncate ${idx === activeWalletIndex ? 'text-primary' : 'text-foreground'}`}>
                                                        {w.pqcKey?.name || w.pqc?.name || 'Wallet ' + (idx + 1)}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                                    {w.address.slice(0, 10)}...{w.address.slice(-6)}
                                                </span>
                                            </div>

                                            {/* Action Buttons (Right) */}
                                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => startEdit(e, idx, w.pqcKey?.name || w.pqc?.name || 'Wallet ' + (idx + 1))}
                                                    className="p-1.5 hover:bg-surface rounded text-[var(--text-muted)] hover:text-primary transition-all"
                                                    title="Rename"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                {onDelete && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm(`Are you sure you want to delete ${w.pqcKey?.name || w.pqc?.name || 'this wallet'}? This action cannot be undone.`)) {
                                                                onDelete(w.address);
                                                            }
                                                        }}
                                                        className="p-1.5 hover:bg-red-500/10 rounded text-[var(--text-muted)] hover:text-red-500 transition-all ml-1"
                                                        title="Delete Wallet"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="p-1 border-t border-border bg-surface/50 space-y-1">
                            <button
                                onClick={() => {
                                    onAdd();
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-foreground font-medium hover:bg-surfaceHighlight hover:text-primary rounded-lg transition-colors group"
                            >
                                <svg className="w-4 h-4 text-[var(--text-muted)] group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Add / Import Wallet
                            </button>

                            <button
                                onClick={() => {
                                    onBackup(activeWalletIndex);
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-foreground font-medium hover:bg-surfaceHighlight hover:text-primary rounded-lg transition-colors group"
                            >
                                <svg className="w-4 h-4 text-[var(--text-muted)] group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Secure Wallet (Backup)
                            </button>

                            <button
                                onClick={() => {
                                    onSettings();
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-foreground font-medium hover:bg-surfaceHighlight hover:text-primary rounded-lg transition-colors group"
                            >
                                <svg className="w-4 h-4 text-[var(--text-muted)] group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Settings
                            </button>

                            {/* Link PQC Option - Always visible, disabled if linked */}
                            {wallets[activeWalletIndex]?.linked ? (
                                <button
                                    disabled
                                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-green-600 dark:text-green-500 font-medium bg-green-500/10 rounded-lg cursor-default transition-colors opacity-80"
                                >
                                    <svg className="w-4 h-4 text-green-600 dark:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    PQC Security Active
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        onLinkPqc?.();
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-500 font-medium hover:bg-yellow-500/10 rounded-lg transition-colors group"
                                >
                                    <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    Link PQC Account
                                </button>
                            )}

                            <div className="h-px bg-white/5 my-1"></div>

                            <button
                                onClick={() => {
                                    onLock();
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-red-400 font-medium hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Lock Wallet
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
