import React from 'react';
import { Send, QrCode, Clock, Coins, Vote } from 'lucide-react';
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
            icon: <Send className="w-4 h-4 text-white" />,
            onClick: () => navigate('/send'),
            active: true,
            bg: 'bg-primary'
        },
        {
            label: 'Receive',
            icon: <QrCode className="w-4 h-4 text-white" />,
            onClick: onReceive,
            active: true,
            bg: 'bg-lumen'
        },
        {
            label: 'Stake',
            icon: <Coins className="w-4 h-4 text-white" />,
            onClick: () => navigate('/stake'),
            active: true,
            bg: 'bg-green-500'
        },
        {
            label: 'Vote',
            icon: <Vote className="w-4 h-4 text-white" />,
            onClick: () => navigate('/governance'),
            active: true,
            bg: 'bg-purple-500'
        },
        {
            label: 'History',
            icon: <Clock className="w-4 h-4 text-white" />,
            onClick: onHistory,
            active: true,
            bg: 'bg-gray-600'
        },
    ];

    return (
        <div className="grid grid-cols-5 gap-3 px-4 py-4">
            {buttons.map((btn, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={btn.active ? btn.onClick : undefined}>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${btn.active ? `${btn.bg} hover:scale-110 hover:shadow-lg active:scale-95` : 'bg-surfaceHighlight opacity-50 cursor-not-allowed'}`}>
                        {btn.icon}
                    </div>
                    <span className={`text-[10px] font-medium transition-colors ${btn.active ? 'text-foreground group-hover:text-primary' : 'text-[var(--text-muted)]'}`}>
                        {btn.label}
                    </span>
                </div>
            ))}
        </div>
    );
};
