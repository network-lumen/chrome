import React from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';
import { X, Copy, Check } from 'lucide-react';

interface ReceiveModalProps {
    address: string;
    onClose: () => void;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({ address, onClose }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose} style={{ margin: 0, left: 0, right: 0, top: 0, bottom: 0 }}>
            <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 relative shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-foreground transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center space-y-6">
                    <h3 className="text-lg font-bold text-foreground">Receive Assets</h3>

                    <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                        <QRCode
                            value={address}
                            size={180}
                            viewBox={`0 0 256 256`}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">Wallet Address</p>
                        <div
                            onClick={handleCopy}
                            className="bg-surfaceHighlight border border-border p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:border-primary/50 transition-all group"
                        >
                            <code className="text-xs text-foreground font-mono truncate">{address}</code>
                            <div className="text-[var(--text-muted)] group-hover:text-primary transition-colors">
                                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </div>
                        </div>
                    </div>

                    <p className="text-[10px] text-[var(--text-dim)]">
                        Only send Lumen (LMN) assets to this address.
                    </p>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
