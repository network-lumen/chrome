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
            icon: <Send size={20} />,
            onClick: () => navigate('/send'),
            active: true
        },
        {
            label: 'Receive',
            icon: <QrCode size={20} />,
            onClick: onReceive,
            active: true
        },
        {
            label: 'Stake',
            icon: <Coins size={20} />,
            onClick: () => navigate('/stake'),
            active: true
        },
        {
            label: 'Vote',
            icon: <Vote size={20} />,
            onClick: () => navigate('/governance'),
            active: true
        },
        {
            label: 'History',
            icon: <Clock size={20} />,
            onClick: onHistory,
            active: true
        },
    ];

    return (
        <div className="grid grid-cols-5 gap-3 px-4 py-3">
            {buttons.map((btn, idx) => (
                <div
                    key={idx}
                    className={`flex flex-col items-center gap-2 group cursor-pointer transition-all duration-300 ${!btn.active ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:-translate-y-1'}`}
                    onClick={btn.active ? btn.onClick : undefined}
                >
                    <div className={`w-[52px] h-[52px] rounded-2xl flex items-center justify-center transition-all duration-500 glass-squircle relative group-hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)]`}>
                        {/* Inner Glow Effect */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className={`transition-all duration-500 group-hover:scale-110 group-active:scale-90 ${btn.active ? 'text-foreground' : 'text-foreground/20'}`}>
                            {btn.icon}
                        </div>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-[0.1em] transition-colors duration-300 ${btn.active ? 'text-foreground/40 group-hover:text-primary' : 'text-foreground/20'}`}>
                        {btn.label}
                    </span>
                </div>
            ))}
        </div>
    );
};
