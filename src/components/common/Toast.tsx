import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertCircle } from 'lucide-react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-500" />;
            case 'warning':
                return <AlertCircle className="w-5 h-5 text-yellow-500" />;
            case 'info':
                return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    const getBgColor = () => {
        switch (type) {
            case 'success':
                return 'bg-green-500/10 border-green-500/30';
            case 'error':
                return 'bg-red-500/10 border-red-500/30';
            case 'warning':
                return 'bg-yellow-500/10 border-yellow-500/30';
            case 'info':
                return 'bg-blue-500/10 border-blue-500/30';
        }
    };

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${getBgColor()} backdrop-blur-md shadow-lg min-w-[280px]`}>
                {getIcon()}
                <p className="text-sm font-medium text-foreground flex-1">{message}</p>
                <button
                    onClick={onClose}
                    className="text-[var(--text-muted)] hover:text-foreground transition-colors"
                >
                    <XCircle className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
