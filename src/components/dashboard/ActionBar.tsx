import React from 'react';
import { Send, QrCode, Clock, Coins } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ActionBarProps {
    onReceive: () => void;
    onHistory: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({ onReceive, onHistory }) => {
    const navigate = useNavigate();

    const buttons = [
        {
            label: 'Send',
            icon: <Send className="w-5 h-5 text-white" />,
            onClick: () => navigate('/send'),
            active: true,
            bg: 'bg-primary'
        },
        {
            label: 'Receive',
            icon: <QrCode className="w-5 h-5 text-white" />,
            onClick: onReceive,
            active: true,
            bg: 'bg-primary'
        },
        {
            label: 'History',
            icon: <Clock className="w-5 h-5 text-white" />,
            onClick: onHistory,
            active: true,
            bg: 'bg-surfaceHighlight'
        },

        {
            label: 'Stake',
            icon: <Coins className="w-5 h-5 text-white" />,
            onClick: () => { },
            active: false,
            bg: 'bg-surfaceHighlight'
        },
    ];

    return (
        <div className="flex justify-center items-start gap-10 px-2 py-4">
            {buttons.map((btn, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={btn.active ? btn.onClick : undefined}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${btn.active ? `${btn.bg} hover:brightness-110 shadow-lg shadow-primary/20` : 'bg-surfaceHighlight opacity-50 cursor-not-allowed'}`}>
                        {btn.icon}
                    </div>
                    <span className={`text-[10px] font-medium ${btn.active ? 'text-foreground' : 'text-[var(--text-muted)]'}`}>
                        {btn.label}
                    </span>
                </div>
            ))}
        </div>
    );
};
