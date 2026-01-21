import React, { useState, useEffect } from 'react';
import { ArrowLeft, Vote, CheckCircle, XCircle, MinusCircle, AlertCircle, RefreshCw } from 'lucide-react';
import type { LumenWallet } from '../../modules/sdk/key-manager';
import { Toast } from '../common/Toast';
import { voteOnProposal } from '../../modules/sdk/governance';

interface GovernanceProps {
    walletKeys: LumenWallet;
    onBack: () => void;
}

interface Proposal {
    id: string;
    title: string;
    description: string;
    status: 'voting' | 'passed' | 'rejected' | 'pending';
    votingEnd: string;
    yesVotes: string;
    noVotes: string;
    abstainVotes: string;
    vetoVotes: string;
    yesVotesRaw: string;
    noVotesRaw: string;
    abstainVotesRaw: string;
    vetoVotesRaw: string;
}

const API_ENDPOINT = 'https://api-lumen.winnode.xyz';

export const Governance: React.FC<GovernanceProps> = ({ walletKeys, onBack }) => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [voteOption, setVoteOption] = useState<'yes' | 'no' | 'abstain' | 'veto' | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error'>('success');

    // Fetch proposals from API
    const fetchProposals = async () => {
        setFetching(true);
        try {
            const response = await fetch(`${API_ENDPOINT}/cosmos/gov/v1/proposals?proposal_status=2`);
            if (!response.ok) throw new Error('Failed to fetch proposals');
            
            const data = await response.json();
            
            const formattedProposals: Proposal[] = data.proposals?.map((p: any) => {
                const yesRaw = p.final_tally_result?.yes_count || p.final_tally_result?.yes || '0';
                const noRaw = p.final_tally_result?.no_count || p.final_tally_result?.no || '0';
                const abstainRaw = p.final_tally_result?.abstain_count || p.final_tally_result?.abstain || '0';
                const vetoRaw = p.final_tally_result?.no_with_veto_count || p.final_tally_result?.no_with_veto || '0';
                
                const totalVotes = BigInt(yesRaw) + BigInt(noRaw) + BigInt(abstainRaw) + BigInt(vetoRaw);
                
                const calculatePercentage = (votes: string) => {
                    if (totalVotes === BigInt(0)) return '0%';
                    const percentage = (Number(BigInt(votes) * BigInt(10000) / totalVotes) / 100).toFixed(1);
                    return `${percentage}%`;
                };
                
                const formatTokens = (amount: string) => {
                    const tokens = Number(amount) / 1000000;
                    if (tokens >= 1000000) {
                        return `${(tokens / 1000000).toFixed(2)}M`;
                    } else if (tokens >= 1000) {
                        return `${(tokens / 1000).toFixed(2)}K`;
                    }
                    return tokens.toFixed(2);
                };

                let status: 'voting' | 'passed' | 'rejected' | 'pending' = 'pending';
                if (p.status === 'PROPOSAL_STATUS_VOTING_PERIOD') status = 'voting';
                else if (p.status === 'PROPOSAL_STATUS_PASSED') status = 'passed';
                else if (p.status === 'PROPOSAL_STATUS_REJECTED') status = 'rejected';

                return {
                    id: p.id || p.proposal_id,
                    title: p.title || p.content?.title || 'Untitled Proposal',
                    description: p.summary || p.content?.description || p.description || 'No description available',
                    status,
                    votingEnd: p.voting_end_time ? new Date(p.voting_end_time).toLocaleDateString() : 'N/A',
                    yesVotes: calculatePercentage(yesRaw),
                    noVotes: calculatePercentage(noRaw),
                    abstainVotes: calculatePercentage(abstainRaw),
                    vetoVotes: calculatePercentage(vetoRaw),
                    yesVotesRaw: formatTokens(yesRaw),
                    noVotesRaw: formatTokens(noRaw),
                    abstainVotesRaw: formatTokens(abstainRaw),
                    vetoVotesRaw: formatTokens(vetoRaw)
                };
            }) || [];

            setProposals(formattedProposals);
        } catch (error) {
            console.error('Error fetching proposals:', error);
            setToastMessage('Failed to fetch proposals from network');
            setToastType('error');
            setShowToast(true);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        fetchProposals();
    }, []);

    const handleVote = async () => {
        if (!selectedProposal || !voteOption || !walletKeys) return;
        setLoading(true);
        
        try {
            const txHash = await voteOnProposal(
                walletKeys,
                selectedProposal.id,
                voteOption,
                API_ENDPOINT
            );
            
            setToastMessage(`Vote submitted! TX: ${txHash.slice(0, 8)}...`);
            setToastType('success');
            setShowToast(true);
            
            // Refresh proposals after voting
            await fetchProposals();
            
            // Close modal and return to list
            setSelectedProposal(null);
            setVoteOption(null);
        } catch (error: any) {
            console.error('Voting error:', error);
            setToastMessage(error.message || 'Failed to submit vote');
            setToastType('error');
            setShowToast(true);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: Proposal['status']) => {
        switch (status) {
            case 'voting': return 'text-primary';
            case 'passed': return 'text-green-500';
            case 'rejected': return 'text-red-500';
            case 'pending': return 'text-yellow-500';
        }
    };

    const getStatusBg = (status: Proposal['status']) => {
        switch (status) {
            case 'voting': return 'bg-primary/10 border-primary/30';
            case 'passed': return 'bg-green-500/10 border-green-500/30';
            case 'rejected': return 'bg-red-500/10 border-red-500/30';
            case 'pending': return 'bg-yellow-500/10 border-yellow-500/30';
        }
    };

    if (selectedProposal) {
        return (
            <div className="flex flex-col h-full bg-background">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
                    <button
                        onClick={() => setSelectedProposal(null)}
                        className="p-1.5 hover:bg-surfaceHighlight rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-foreground" />
                    </button>
                    <h1 className="text-base font-semibold text-foreground">Proposal #{selectedProposal.id}</h1>
                    <div className="w-8" />
                </div>

                {/* Proposal Details */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    <div className="bg-surface border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-base font-semibold text-foreground">{selectedProposal.title}</h2>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${getStatusBg(selectedProposal.status)} ${getStatusColor(selectedProposal.status)}`}>
                                {selectedProposal.status}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">
                            {selectedProposal.description}
                        </p>
                        <div className="text-[10px] text-[var(--text-dim)]">
                            Voting ends: {selectedProposal.votingEnd}
                        </div>
                    </div>

                    {/* Vote Distribution */}
                    <div className="bg-surface border border-border rounded-lg p-3">
                        <h3 className="text-xs font-semibold text-foreground mb-2">Current Results</h3>
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-green-500 font-semibold">Yes</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-foreground font-bold">{selectedProposal.yesVotesRaw} LMN</span>
                                        <span className="text-[var(--text-muted)]">({selectedProposal.yesVotes})</span>
                                    </div>
                                </div>
                                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500" style={{ width: selectedProposal.yesVotes }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-red-500 font-semibold">No</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-foreground font-bold">{selectedProposal.noVotesRaw} LMN</span>
                                        <span className="text-[var(--text-muted)]">({selectedProposal.noVotes})</span>
                                    </div>
                                </div>
                                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500" style={{ width: selectedProposal.noVotes }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-yellow-500 font-semibold">Abstain</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-foreground font-bold">{selectedProposal.abstainVotesRaw} LMN</span>
                                        <span className="text-[var(--text-muted)]">({selectedProposal.abstainVotes})</span>
                                    </div>
                                </div>
                                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                                    <div className="h-full bg-yellow-500" style={{ width: selectedProposal.abstainVotes }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-orange-500 font-semibold">Veto</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-foreground font-bold">{selectedProposal.vetoVotesRaw} LMN</span>
                                        <span className="text-[var(--text-muted)]">({selectedProposal.vetoVotes})</span>
                                    </div>
                                </div>
                                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-500" style={{ width: selectedProposal.vetoVotes }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Vote Options */}
                    {selectedProposal.status === 'voting' && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-foreground">Cast Your Vote</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setVoteOption('yes')}
                                    className={`p-3 rounded-lg border transition-colors ${
                                        voteOption === 'yes'
                                            ? 'border-green-500 bg-green-500/10'
                                            : 'border-border bg-surface hover:border-green-500/50'
                                    }`}
                                >
                                    <CheckCircle className={`w-5 h-5 mx-auto mb-1 ${voteOption === 'yes' ? 'text-green-500' : 'text-[var(--text-muted)]'}`} />
                                    <p className="text-xs font-semibold text-foreground">Yes</p>
                                </button>
                                <button
                                    onClick={() => setVoteOption('no')}
                                    className={`p-3 rounded-lg border transition-colors ${
                                        voteOption === 'no'
                                            ? 'border-red-500 bg-red-500/10'
                                            : 'border-border bg-surface hover:border-red-500/50'
                                    }`}
                                >
                                    <XCircle className={`w-5 h-5 mx-auto mb-1 ${voteOption === 'no' ? 'text-red-500' : 'text-[var(--text-muted)]'}`} />
                                    <p className="text-xs font-semibold text-foreground">No</p>
                                </button>
                                <button
                                    onClick={() => setVoteOption('abstain')}
                                    className={`p-3 rounded-lg border transition-colors ${
                                        voteOption === 'abstain'
                                            ? 'border-yellow-500 bg-yellow-500/10'
                                            : 'border-border bg-surface hover:border-yellow-500/50'
                                    }`}
                                >
                                    <MinusCircle className={`w-5 h-5 mx-auto mb-1 ${voteOption === 'abstain' ? 'text-yellow-500' : 'text-[var(--text-muted)]'}`} />
                                    <p className="text-xs font-semibold text-foreground">Abstain</p>
                                </button>
                                <button
                                    onClick={() => setVoteOption('veto')}
                                    className={`p-3 rounded-lg border transition-colors ${
                                        voteOption === 'veto'
                                            ? 'border-orange-500 bg-orange-500/10'
                                            : 'border-border bg-surface hover:border-orange-500/50'
                                    }`}
                                >
                                    <AlertCircle className={`w-5 h-5 mx-auto mb-1 ${voteOption === 'veto' ? 'text-orange-500' : 'text-[var(--text-muted)]'}`} />
                                    <p className="text-xs font-semibold text-foreground">Veto</p>
                                </button>
                            </div>

                            <button
                                onClick={handleVote}
                                disabled={!voteOption || loading}
                                className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-hover hover:to-primary disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95"
                            >
                                {loading ? 'Submitting Vote...' : 'Submit Vote'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border bg-surface/80 backdrop-blur-xl">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-surfaceHighlight rounded-xl transition-all duration-300 hover:scale-110 active:scale-95"
                >
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <h1 className="text-lg font-bold text-foreground">Governance</h1>
                <button
                    onClick={fetchProposals}
                    disabled={fetching}
                    className="p-2 hover:bg-surfaceHighlight rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 disabled:scale-100"
                >
                    <RefreshCw className={`w-5 h-5 text-foreground transition-transform ${fetching ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Proposals List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {fetching ? (
                    <div className="text-center py-10">
                        <RefreshCw className="w-10 h-10 text-primary mx-auto mb-2 animate-spin" />
                        <p className="text-sm text-[var(--text-muted)]">Loading proposals...</p>
                    </div>
                ) : proposals.filter(p => p.status === 'voting').length === 0 ? (
                    <div className="text-center py-10">
                        <Vote className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
                        <p className="text-sm text-[var(--text-muted)]">No active proposals</p>
                        <p className="text-[10px] text-[var(--text-dim)] mt-1">Check back later for new proposals</p>
                    </div>
                ) : (
                    proposals
                        .filter(proposal => proposal.status === 'voting')
                        .map((proposal) => (
                            <button
                                key={proposal.id}
                                onClick={() => setSelectedProposal(proposal)}
                                className="w-full bg-surface border border-border rounded-2xl p-4 hover:border-primary/50 transition-all duration-300 hover:scale-[1.02] text-left"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Vote className="w-3.5 h-3.5 text-primary" />
                                            <span className="text-[10px] font-medium text-[var(--text-muted)]">Proposal #{proposal.id}</span>
                                        </div>
                                        <h3 className="font-semibold text-sm text-foreground mb-1">{proposal.title}</h3>
                                        <p className="text-[10px] text-[var(--text-muted)] line-clamp-2">{proposal.description}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${getStatusBg(proposal.status)} ${getStatusColor(proposal.status)} ml-2 shrink-0`}>
                                        {proposal.status}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] mt-2">
                                    <span className="text-[var(--text-dim)]">Ends: {proposal.votingEnd}</span>
                                    <div className="flex gap-2">
                                        <span className="text-green-500 font-semibold">Yes {proposal.yesVotesRaw}</span>
                                        <span className="text-red-500 font-semibold">No {proposal.noVotesRaw}</span>
                                    </div>
                                </div>
                            </button>
                        ))
                )}
            </div>

            {/* Toast Notification */}
            {showToast && (
                <Toast
                    message={toastMessage}
                    type={toastType}
                    onClose={() => setShowToast(false)}
                />
            )}
        </div>
    );
};
