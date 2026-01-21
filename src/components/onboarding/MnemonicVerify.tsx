import React, { useState, useEffect } from 'react';

interface MnemonicVerifyProps {
    mnemonic: string;
    onVerified: () => void;
    onBack: () => void;
}

export const MnemonicVerify: React.FC<MnemonicVerifyProps> = ({ mnemonic, onVerified, onBack }) => {
    const words = mnemonic.split(' ');
    const [selectedWords, setSelectedWords] = useState<{ [key: number]: string }>({});
    const [shuffledWords, setShuffledWords] = useState<string[]>([]);
    const [error, setError] = useState('');

    // Generate 3 random positions to verify
    const [verifyPositions] = useState(() => {
        const positions: number[] = [];
        while (positions.length < 3) {
            const pos = Math.floor(Math.random() * words.length);
            if (!positions.includes(pos)) {
                positions.push(pos);
            }
        }
        return positions.sort((a, b) => a - b);
    });

    useEffect(() => {
        // Create shuffled array with correct words and some random words
        const correctWords = verifyPositions.map(pos => words[pos]);
        const otherWords = words.filter((_, idx) => !verifyPositions.includes(idx));
        const randomWords = otherWords.sort(() => Math.random() - 0.5).slice(0, 6);
        const allWords = [...correctWords, ...randomWords].sort(() => Math.random() - 0.5);
        setShuffledWords(allWords);
    }, []);

    const handleWordSelect = (position: number, word: string) => {
        setSelectedWords(prev => ({ ...prev, [position]: word }));
        setError('');
    };

    const handleVerify = () => {
        let isCorrect = true;
        for (const pos of verifyPositions) {
            if (selectedWords[pos] !== words[pos]) {
                isCorrect = false;
                break;
            }
        }

        if (isCorrect) {
            onVerified();
        } else {
            setError('The selected words do not match. Please try again.');
        }
    };

    const isComplete = verifyPositions.every(pos => selectedWords[pos]);

    return (
        <div className="flex flex-col h-full justify-between p-8 animate-fade-in overflow-y-auto">
            <div className="flex-1">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
                        <div className="relative w-full h-full bg-gradient-to-br from-primary to-primary-light rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Verify Recovery Phrase</h2>
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-sm mx-auto">
                        Select the correct words to verify you saved your recovery phrase
                    </p>
                </div>

                {/* Verification Slots */}
                <div className="space-y-4 mb-6">
                    {verifyPositions.map((position) => (
                        <div key={position} className="space-y-2">
                            <label className="text-xs font-semibold text-[var(--text-muted)] ml-1 uppercase tracking-wide">
                                Word #{position + 1}
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {shuffledWords.map((word, idx) => (
                                    <button
                                        key={`${position}-${idx}`}
                                        onClick={() => handleWordSelect(position, word)}
                                        className={`p-3 rounded-lg border-2 transition-all font-mono text-sm font-semibold ${
                                            selectedWords[position] === word
                                                ? 'bg-primary border-primary text-white'
                                                : 'bg-surface border-border text-foreground hover:border-primary/50'
                                        }`}
                                    >
                                        {word}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 animate-fade-in">
                        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Info Box */}
                <div className="p-4 bg-surface/50 border border-border rounded-xl">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                            <p className="font-semibold text-foreground mb-1">Why verify?</p>
                            <p>This ensures you've correctly saved your recovery phrase. Without it, you won't be able to restore your wallet if you lose access.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mt-6">
                <button
                    onClick={handleVerify}
                    disabled={!isComplete}
                    className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-hover hover:to-primary disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
                >
                    Verify & Continue
                </button>

                <button
                    onClick={onBack}
                    className="w-full text-[var(--text-muted)] hover:text-foreground font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
            </div>
        </div>
    );
};
