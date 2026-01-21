import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, User, Search, Check } from 'lucide-react';
import { useContacts } from '../../hooks/useContacts';

interface ContactsModalProps {
    onClose: () => void;
    onSelect?: (address: string) => void;
}

export const ContactsModal: React.FC<ContactsModalProps> = ({ onClose, onSelect }) => {
    const { contacts, addContact, removeContact } = useContacts();
    const [view, setView] = useState<'list' | 'add'>('list');
    const [searchTerm, setSearchTerm] = useState('');

    // Add Form State
    const [newName, setNewName] = useState('');
    const [newAddress, setNewAddress] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName && newAddress) {
            addContact(newName, newAddress);
            setNewName('');
            setNewAddress('');
            setView('list');
        }
    };

    const filtered = contacts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.address.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose} style={{ margin: 0, left: 0, right: 0, top: 0, bottom: 0 }}>
            <div className="w-full max-w-sm h-[500px] bg-surface border border-border rounded-xl shadow-2xl flex flex-col relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-surface/80 backdrop-blur">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        Contacts
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-surfaceHighlight rounded-full transition-colors text-[var(--text-muted)] hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {view === 'list' ? (
                    <>
                        {/* Search & Add Bar */}
                        <div className="p-3 border-b border-border bg-surfaceHighlight/20 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search name or address..."
                                    className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground focus:border-primary outline-none"
                                />
                            </div>
                            <button
                                onClick={() => setView('add')}
                                className="p-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2 min-h-[200px]">
                                    <div className="w-12 h-12 bg-surfaceHighlight rounded-full flex items-center justify-center">
                                        <User className="w-6 h-6 opacity-30" />
                                    </div>
                                    <p className="text-sm">No contacts found</p>
                                    <button onClick={() => setView('add')} className="text-xs text-primary font-bold hover:underline">Add New Contact</button>
                                </div>
                            ) : (
                                filtered.map(contact => (
                                    <div
                                        key={contact.id}
                                        onClick={() => onSelect?.(contact.address)}
                                        className={`group bg-surface hover:bg-surfaceHighlight border border-border rounded-xl p-3 flex items-center justify-between transition-all ${onSelect ? 'cursor-pointer hover:border-primary/50' : ''}`}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                                <span className="font-bold text-xs">{contact.name.substring(0, 2).toUpperCase()}</span>
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-bold text-foreground truncate">{contact.name}</p>
                                                <p className="text-[10px] text-[var(--text-muted)] font-mono truncate w-32 md:w-48">{contact.address}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {onSelect && (
                                                <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center group-hover:border-primary group-hover:bg-primary/10 transition-colors">
                                                    <Check className="w-3 h-3 text-transparent group-hover:text-primary" />
                                                </div>
                                            )}
                                            {!onSelect && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeContact(contact.id); }}
                                                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    <form onSubmit={handleAdd} className="p-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-[var(--text-muted)]">Name</label>
                            <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Alice"
                                className="w-full bg-surface border border-border rounded-xl p-3 text-foreground text-sm focus:border-primary outline-none"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-[var(--text-muted)]">Address</label>
                            <input
                                value={newAddress}
                                onChange={(e) => setNewAddress(e.target.value)}
                                placeholder="lmn1..."
                                className="w-full bg-surface border border-border rounded-xl p-3 text-foreground font-mono text-xs focus:border-primary outline-none"
                                required
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setView('list')}
                                className="flex-1 py-2.5 rounded-xl font-bold text-foreground bg-surfaceHighlight hover:bg-border transition-colors text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-hover transition-colors text-xs"
                            >
                                Save Contact
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
