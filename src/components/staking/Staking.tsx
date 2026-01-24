import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Award, Users, ChevronRight, RefreshCw, Info, CheckCircle2, ShieldCheck, PieChart, AlertCircle, Search } from 'lucide-react';
import { HistoryManager } from '../../modules/history/history';
import type { LumenWallet } from '../../modules/sdk/key-manager';
import { Toast } from '../common/Toast';
import {
    fetchDelegations,
    fetchRewards,
    fetchValidators,
    fetchValidator,
    delegateTokens,
    undelegateTokens,
    claimRewards,
    fetchUnbondingDelegations
} from '../../modules/sdk/staking';

interface StakingProps {
    walletKeys: LumenWallet;
    onBack: () => void;
}

interface Validator {
    address: string;
    moniker: string;
    commission: string;
    votingPower: string;
    status: 'active' | 'inactive';
    apr: string;
}

interface UserStake {
    validator: Validator;
    amount: string;
    rewards: string;
    validatorAddress: string;
}

interface UnbondingEntry {
    validatorMoniker: string;
    amount: string;
    completionTime: string;
}

export const Staking: React.FC<StakingProps> = ({ walletKeys, onBack }) => {
    const [activeTab, setActiveTab] = useState<'stake' | 'unstake' | 'rewards'>('stake');
    const [validators, setValidators] = useState<Validator[]>([]);
    const [userStakes, setUserStakes] = useState<UserStake[]>([]);
    const [selectedValidator, setSelectedValidator] = useState<Validator | null>(null);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const [totalStaked, setTotalStaked] = useState('0');
    const [totalRewards, setTotalRewards] = useState('0');
    const [step, setStep] = useState<'dashboard' | 'detail' | 'confirm'>('dashboard');
    const [balanceUlmn, setBalanceUlmn] = useState('0');
    const [searchTerm, setSearchTerm] = useState('');
    const [unbondingEntries, setUnbondingEntries] = useState<UnbondingEntry[]>([]);
    const [showUnstakeConfirm, setShowUnstakeConfirm] = useState(false);
    const [stakeToUnstake, setStakeToUnstake] = useState<UserStake | null>(null);

    const hasStakes = userStakes.length > 0;

    // Fetch user's delegations and rewards
    const fetchUserStakingData = async () => {
        if (!walletKeys?.address) return;

        setFetching(true);
        try {
            // Fetch delegations
            const delegations = await fetchDelegations(walletKeys.address);

            // Fetch rewards
            const rewardsData = await fetchRewards(walletKeys.address);

            // Calculate total staked
            let totalStakedAmount = BigInt(0);
            const stakes: UserStake[] = [];

            for (const delegation of delegations) {
                const validatorAddr = delegation.delegation.validator_address;
                const stakedAmount = delegation.balance.amount;
                totalStakedAmount += BigInt(stakedAmount);

                // Fetch validator info
                const validatorInfo = await fetchValidator(validatorAddr);

                // Find rewards for this validator
                const validatorRewards = rewardsData.rewards.find(
                    (r: any) => r.validator_address === validatorAddr
                );
                const rewardAmount = validatorRewards?.reward?.find((r: any) => r.denom === 'ulmn')?.amount || '0';

                if (validatorInfo) {
                    const commissionRate = parseFloat(validatorInfo.commission.commission_rates.rate) * 100;

                    stakes.push({
                        validator: {
                            address: validatorAddr,
                            moniker: validatorInfo.description.moniker,
                            commission: `${commissionRate.toFixed(1)}%`,
                            votingPower: (Number(validatorInfo.tokens) / 1000000).toFixed(0),
                            status: validatorInfo.status === 'BOND_STATUS_BONDED' ? 'active' : 'inactive',
                            apr: '12.5%' // Calculate from chain params if available
                        },
                        amount: (Number(stakedAmount) / 1000000).toFixed(2),
                        rewards: (parseFloat(rewardAmount) / 1000000).toFixed(6),
                        validatorAddress: validatorAddr
                    });
                }
            }

            setUserStakes(stakes);
            setTotalStaked((Number(totalStakedAmount) / 1000000).toFixed(2));

            // Calculate total rewards
            const totalRewardsAmount = rewardsData.total.find((r: any) => r.denom === 'ulmn')?.amount || '0';
            setTotalRewards((parseFloat(totalRewardsAmount) / 1000000).toFixed(6));

            // Fetch Unbonding
            const unbondingData = await fetchUnbondingDelegations(walletKeys.address);
            const processedUnbonding: UnbondingEntry[] = [];
            for (const unbond of unbondingData) {
                const valInfo = await fetchValidator(unbond.validator_address);
                for (const entry of unbond.entries) {
                    processedUnbonding.push({
                        validatorMoniker: valInfo?.description?.moniker || 'Unknown',
                        amount: (Number(entry.balance) / 1000000).toFixed(2),
                        completionTime: entry.completion_time
                    });
                }
            }
            setUnbondingEntries(processedUnbonding);

        } catch (error) {
            console.error('Error fetching staking data:', error);
            setToastMessage('Failed to fetch staking data');
            setToastType('error');
            setShowToast(true);
        } finally {
            setFetching(false);
        }
    };

    // Fetch validators list
    const fetchValidatorsList = async () => {
        try {
            const validatorsData = await fetchValidators();

            const formattedValidators: Validator[] = validatorsData.map((v: any) => {
                const commissionRate = parseFloat(v.commission.commission_rates.rate) * 100;

                return {
                    address: v.operator_address,
                    moniker: v.description.moniker,
                    commission: `${commissionRate.toFixed(1)}%`,
                    votingPower: (Number(v.tokens) / 1000000).toFixed(0),
                    status: v.status === 'BOND_STATUS_BONDED' ? 'active' : 'inactive',
                    apr: '12.5%' // Calculate from chain params if available
                };
            });

            setValidators(formattedValidators);

            // Also fetch wallet balance for validation
            const res = await fetch(`https://api-lumen.winnode.xyz/cosmos/bank/v1beta1/balances/${walletKeys.address}`);
            if (res.ok) {
                const data = await res.json();
                const bal = data.balances.find((b: any) => b.denom === 'ulmn')?.amount || '0';
                setBalanceUlmn(bal);
            }
        } catch (error) {
            console.error('Error fetching validators:', error);
        }
    };

    useEffect(() => {
        fetchUserStakingData();
        fetchValidatorsList();
    }, [walletKeys?.address]);

    const handleStake = async () => {
        if (!selectedValidator || !amount || !walletKeys) return;
        setLoading(true);

        try {
            const amountUlmn = (parseFloat(amount) * 1000000).toString();
            if (BigInt(amountUlmn) > BigInt(balanceUlmn)) {
                throw new Error("Insufficient balance");
            }

            const txHash = await delegateTokens(walletKeys, selectedValidator.address, amountUlmn);

            // Save to History
            HistoryManager.saveTransaction(walletKeys.address, {
                hash: txHash,
                height: "...",
                timestamp: new Date().toISOString(),
                type: 'stake',
                amount: amount,
                denom: 'LMN',
                counterparty: selectedValidator.moniker,
                status: 'success'
            });

            setToastMessage(`Staked successfully!`);
            setToastType('success');
            setShowToast(true);
            setAmount('');
            setSelectedValidator(null);
            setStep('dashboard');

            // Refresh data
            await fetchUserStakingData();
        } catch (error: any) {
            console.error('Staking error:', error);
            setToastMessage(error.message || 'Failed to stake');
            setToastType('error');
            setShowToast(true);
        } finally {
            setLoading(false);
        }
    };

    const handleUnstake = async (stake: UserStake) => {
        setStakeToUnstake(stake);
        setShowUnstakeConfirm(true);
    };

    const confirmUnstake = async () => {
        if (!walletKeys || !stakeToUnstake) return;
        setLoading(true);
        setShowUnstakeConfirm(false);

        try {
            const amountUlmn = (parseFloat(stakeToUnstake.amount) * 1000000).toString();
            const txHash = await undelegateTokens(walletKeys, stakeToUnstake.validatorAddress, amountUlmn);

            setToastMessage(`Unstaked successfully! Asset is now unbonding. TX: ${txHash.slice(0, 8)}...`);
            setToastType('success');
            setShowToast(true);

            // Refresh data
            await fetchUserStakingData();
        } catch (error: any) {
            console.error('Unstaking error:', error);
            setToastMessage(error.message || 'Failed to unstake');
            setToastType('error');
            setShowToast(true);
        } finally {
            setLoading(false);
            setStakeToUnstake(null);
        }
    };

    const handleClaimRewards = async (validatorAddress: string) => {
        if (!walletKeys) return;
        setLoading(true);

        try {
            const txHash = await claimRewards(walletKeys, validatorAddress);

            // Save to History
            HistoryManager.saveTransaction(walletKeys.address, {
                hash: txHash,
                height: "...",
                timestamp: new Date().toISOString(),
                type: 'claim',
                amount: 'Checking...',
                denom: 'LMN',
                counterparty: 'Rewards',
                status: 'success'
            });

            setToastMessage(`Rewards claimed!`);
            setToastType('success');
            setShowToast(true);

            // Refresh data
            await fetchUserStakingData();
        } catch (error: any) {
            console.error('Claim rewards error:', error);
            setToastMessage(error.message || 'Failed to claim rewards');
        } finally {
            setLoading(false);
        }
    };

    const filteredValidators = validators
        .filter(v =>
            v.moniker.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.address.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => Number(b.votingPower) - Number(a.votingPower));

    return (
        <div className="flex flex-col h-full bg-background relative">
            <style>{`
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type=number] {
                    -moz-appearance: textfield;
                }
                @keyframes progress-slow {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
                .animate-progress-slow {
                    animation: progress-slow 3s infinite linear;
                }
            `}</style>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-1.5 premium-header backdrop-blur-xl shrink-0 z-20">
                <button
                    onClick={() => {
                        if (step === 'dashboard') onBack();
                        else if (step === 'detail') setStep('dashboard');
                        else if (step === 'confirm') setStep('detail');
                    }}
                    className="p-1.5 hover:bg-surfaceHighlight rounded-lg transition-all duration-300 hover:scale-110 active:scale-95"
                >
                    <ArrowLeft className="w-4 h-4 text-foreground" />
                </button>
                <h1 className="text-base font-bold text-foreground tracking-tight">
                    {step === 'dashboard' ? 'Staking' : step === 'detail' ? 'Manage Stake' : 'Confirm Staking'}
                </h1>
                <button
                    onClick={fetchUserStakingData}
                    disabled={fetching}
                    className="p-1.5 hover:bg-surfaceHighlight rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 disabled:scale-100"
                >
                    <RefreshCw className={`w-4 h-4 text-foreground transition-transform ${fetching ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Dashboard View */}
            {step === 'dashboard' && (
                <div className="flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-1.5 p-3 pb-2">
                        <div className="bg-surface border border-border rounded-lg p-2 hover:bg-surfaceHighlight transition-colors min-w-0">
                            <div className="flex items-center gap-1 mb-1">
                                <TrendingUp className="w-3 h-3 text-primary" />
                                <span className="text-[8px] text-[var(--text-dim)] uppercase font-bold tracking-wider">APR</span>
                            </div>
                            <p className="text-sm font-bold text-foreground truncate">12.5%</p>
                        </div>
                        <div className="bg-surface border border-border rounded-lg p-2 hover:bg-surfaceHighlight transition-colors min-w-0">
                            <div className="flex items-center gap-1 mb-1">
                                <Award className="w-3 h-3 text-lumen" />
                                <span className="text-[8px] text-[var(--text-dim)] uppercase font-bold tracking-wider">Staked</span>
                            </div>
                            <div className="flex items-baseline gap-0.5 min-w-0 overflow-hidden">
                                <p className={`font-bold text-foreground truncate ${totalStaked.length > 8 ? 'text-xs' : 'text-sm'}`}>
                                    {totalStaked}
                                </p>
                                <span className="text-[7px] font-bold text-[var(--text-dim)] shrink-0">LMN</span>
                            </div>
                        </div>
                        <div className="bg-surface border border-border rounded-lg p-2 hover:bg-surfaceHighlight transition-colors min-w-0">
                            <div className="flex items-center gap-1 mb-1">
                                <Users className="w-3 h-3 text-green-500" />
                                <span className="text-[8px] text-[var(--text-dim)] uppercase font-bold tracking-wider">Rewards</span>
                            </div>
                            <div className="flex items-baseline gap-0.5 min-w-0 overflow-hidden">
                                <p className={`font-bold text-foreground truncate ${totalRewards.length > 8 ? 'text-xs' : 'text-sm'}`}>
                                    {totalRewards}
                                </p>
                                <span className="text-[7px] font-bold text-[var(--text-dim)] shrink-0">LMN</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 px-4 mb-3">
                        {['stake', 'unstake', 'rewards'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`flex-1 py-2 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all duration-300 ${activeTab === tab
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                    : 'bg-surface text-[var(--text-dim)] hover:bg-surfaceHighlight'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto px-3 pb-24 scrollbar-hide">
                        {activeTab === 'stake' && (
                            <div className="space-y-4">
                                {hasStakes && (
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-dim)] mb-2 px-1">Your Active Stakes</h3>
                                        <div className="space-y-2">
                                            {userStakes.map((stake, idx) => (
                                                <div key={idx} className="bg-surface border border-border rounded-xl p-4 group hover:border-primary/50 transition-all duration-300">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
                                                                <Award size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-sm text-foreground">{stake.validator.moniker}</p>
                                                                <p className="text-[9px] text-[var(--text-muted)] font-mono">{stake.validator.address.slice(0, 16)}...</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-black text-foreground">{stake.amount} LMN</p>
                                                            <p className="text-[9px] text-green-500 font-bold">+{stake.rewards} LMN</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-dim)]">Select Validator</h3>
                                        <span className="text-[9px] font-bold text-primary">{filteredValidators.length} active</span>
                                    </div>

                                    {/* Search Bar */}
                                    <div className="relative mb-3 group">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-dim)] group-focus-within:text-primary transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Search moniker or address..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-surface border border-border rounded-xl py-2 px-9 text-[11px] focus:border-primary focus:bg-surfaceHighlight outline-none transition-all shadow-inner"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        {filteredValidators.map((validator) => (
                                            <button
                                                key={validator.address}
                                                onClick={() => {
                                                    setSelectedValidator(validator);
                                                    setStep('detail');
                                                }}
                                                className="w-full bg-surface border border-border rounded-xl p-2.5 flex items-center justify-between group hover:border-primary/50 transition-all duration-300 hover:scale-[1.01]"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 bg-surfaceHighlight border border-border rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500">
                                                        <ShieldCheck size={16} className="opacity-50 group-hover:opacity-100" />
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-bold text-[13px] text-foreground tracking-tight">{validator.moniker}</p>
                                                        <div className="flex items-center gap-1.5 opacity-60">
                                                            <span className="text-[9px] font-bold text-foreground/50">{validator.commission} fee</span>
                                                            <span className="text-[9px] font-bold text-foreground/20">•</span>
                                                            <span className="text-[9px] font-bold text-primary/80">{Number(validator.votingPower).toLocaleString()} LMN staked</span>
                                                            <span className="text-[9px] font-bold text-foreground/20">•</span>
                                                            <span className="text-[9px] font-bold text-green-500">{validator.apr} APR</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-border group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                            </button>
                                        ))}
                                        {filteredValidators.length === 0 && (
                                            <div className="text-center py-8 text-[var(--text-dim)] text-xs font-semibold">No validators found matching "{searchTerm}"</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'unstake' && (
                            <div className="space-y-4">
                                {unbondingEntries.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-lumen mb-2 px-1">Unbonding Assets</h3>
                                        {unbondingEntries.map((entry, idx) => (
                                            <div key={idx} className="bg-lumen/5 border border-lumen/20 rounded-xl p-3 relative overflow-hidden">
                                                <div className="flex justify-between items-start mb-2 relative z-10">
                                                    <div>
                                                        <p className="font-bold text-xs text-foreground tracking-tight">{entry.validatorMoniker}</p>
                                                        <p className="text-[9px] text-[var(--text-dim)] font-medium">Completes: {new Date(entry.completionTime).toLocaleDateString()}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-foreground">{entry.amount} LMN</p>
                                                        <p className="text-[9px] text-lumen font-bold animate-pulse">Unbonding...</p>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1 bg-border/30 rounded-full overflow-hidden">
                                                    <div className="w-1/3 h-full bg-lumen animate-progress-slow"></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-dim)] mb-2 px-1">Staked Assets</h3>
                                    {fetching ? (
                                        <div className="text-center py-10 opacity-50"><RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" /></div>
                                    ) : hasStakes ? (
                                        <div className="space-y-2">
                                            {userStakes.map((stake, idx) => (
                                                <div key={idx} className="bg-surface border border-border rounded-xl p-4 group">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center"><Award size={18} /></div>
                                                            <div>
                                                                <p className="font-bold text-sm">{stake.validator.moniker}</p>
                                                                <p className="text-[9px] text-[var(--text-muted)]">Staked: {stake.amount} LMN</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleUnstake(stake)}
                                                        disabled={loading}
                                                        className="w-full py-2.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-bold hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                                                    >
                                                        {loading ? 'Processing...' : 'Unstake Assets'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-[var(--text-dim)] text-xs font-semibold">No active stakes found.</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'rewards' && (
                            <div className="space-y-2">
                                {fetching ? (
                                    <div className="text-center py-10 opacity-50"><RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" /></div>
                                ) : hasStakes ? (
                                    userStakes.map((stake, idx) => (
                                        <div key={idx} className="bg-surface border border-border rounded-xl p-4 group">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center"><CheckCircle2 size={18} /></div>
                                                    <div>
                                                        <p className="font-bold text-sm">{stake.validator.moniker}</p>
                                                        <p className="text-[10px] text-green-500 font-bold">+{stake.rewards} LMN Accumulated</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleClaimRewards(stake.validatorAddress)}
                                                disabled={loading || parseFloat(stake.rewards) === 0}
                                                className="w-full py-2.5 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-all disabled:opacity-30"
                                            >
                                                {loading ? 'Claiming...' : 'Claim Available Rewards'}
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-[var(--text-dim)] text-xs font-semibold">No rewards to claim.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Detail View */}
            {step === 'detail' && selectedValidator && (
                <div className="flex flex-col h-full bg-surface/30 px-4 pt-3 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex-1 space-y-4 overflow-y-auto scrollbar-hide">
                        {/* Validator Card */}
                        <div className="bg-surface border border-border rounded-2xl p-4 shadow-2xl relative overflow-hidden group">
                            <div className="absolute -top-4 -right-2 p-2 opacity-5">
                                <PieChart size={100} />
                            </div>
                            <div className="flex items-center gap-3 mb-3 shrink-0">
                                <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                                    <ShieldCheck size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-black text-foreground truncate">{selectedValidator.moniker}</h4>
                                    <p className="text-[8px] text-[var(--text-muted)] font-mono tracking-tight truncate">{selectedValidator.address}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-0.5">
                                    <span className="text-[8px] font-black uppercase text-[var(--text-dim)] tracking-widest">APR Reward</span>
                                    <p className="text-sm font-black text-green-500">{selectedValidator.apr}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-[8px] font-black uppercase text-[var(--text-dim)] tracking-widest">Commission</span>
                                    <p className="text-sm font-black text-foreground">{selectedValidator.commission}</p>
                                </div>
                            </div>
                        </div>

                        {/* Amount Input Section */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-dim)]">Enter Amount</label>
                                <div className="text-[9px] font-bold text-primary">
                                    Max: {(Number(balanceUlmn) / 1000000).toFixed(2)} LMN
                                </div>
                            </div>
                            <div className="relative group">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-surface border-2 border-border rounded-xl p-3 text-lg font-black focus:border-primary outline-none transition-all pr-16 shadow-inner"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <button
                                        onClick={() => setAmount((Number(balanceUlmn) / 1000000).toString())}
                                        className="text-[9px] font-black text-primary uppercase hover:bg-primary/10 px-1.5 py-1 rounded transition-colors"
                                    >MAX</button>
                                </div>
                            </div>
                            {amount && parseFloat(amount) <= 0 && (
                                <div className="flex items-center gap-1.5 px-1 text-red-500">
                                    <AlertCircle size={10} />
                                    <span className="text-[9px] font-bold">Amount must be greater than 0</span>
                                </div>
                            )}
                        </div>

                        {/* Info Alert */}
                        <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex gap-2">
                            <Info size={14} className="text-primary shrink-0 mt-0.5" />
                            <p className="text-[9px] text-foreground/60 leading-relaxed font-medium">
                                Tokens bonded to validator. Unbonding takes 21 days on Cosmos networks.
                            </p>
                        </div>
                    </div>

                    <div className="pb-24 pt-4 shrink-0">
                        <button
                            onClick={() => setStep('confirm')}
                            disabled={!amount || parseFloat(amount) <= 0}
                            className="w-full py-3.5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            Review Transaction
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {step === 'confirm' && selectedValidator && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300 p-4">
                    <div className="w-full max-w-sm bg-background border border-border rounded-[32px] p-6 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
                        <div className="text-center space-y-1">
                            <h3 className="text-lg font-black">Confirm Staking</h3>
                            <p className="text-xs text-[var(--text-muted)] font-semibold">Review your transaction details</p>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-[var(--text-dim)] font-bold">Action</span>
                                    <span className="font-black text-primary uppercase tracking-wider">Stake Assets</span>
                                </div>
                                <div className="h-[1px] bg-border/50" />
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-[var(--text-dim)] font-bold">Validator</span>
                                    <span className="font-black">{selectedValidator.moniker}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-[var(--text-dim)] font-bold">Commission</span>
                                    <span className="font-black">{selectedValidator.commission}</span>
                                </div>
                                <div className="h-[1px] bg-border/50" />
                                <div className="flex justify-between items-center">
                                    <span className="text-[var(--text-dim)] text-xs font-bold">Total Amount</span>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-foreground">{amount} LMN</p>
                                        <p className="text-[9px] text-[var(--text-muted)] font-bold">≈ $0 USD</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 px-2 text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-[0.1em]">
                                <ShieldCheck size={12} className="text-green-500" />
                                Secured by Post-Quantum Dilithium3
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setStep('detail')}
                                className="flex-1 py-4 bg-surfaceHighlight text-foreground rounded-2xl font-black text-sm hover:bg-border transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleStake}
                                disabled={loading}
                                className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {loading && <RefreshCw size={16} className="animate-spin" />}
                                {loading ? 'Broadcasting...' : 'Confirm & Stake'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unstake Warning Modal */}
            {showUnstakeConfirm && stakeToUnstake && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-background border border-border rounded-[32px] p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Info size={32} />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-foreground">Confirm Unstake</h3>
                            <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed px-2">
                                Unstaking will start a <span className="text-red-500 font-bold">21-day unbonding period</span>. During this time, you will not earn rewards and cannot move your tokens.
                            </p>
                        </div>

                        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                <span className="text-[var(--text-dim)]">Amount</span>
                                <span className="text-foreground">{stakeToUnstake.amount} LMN</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                <span className="text-[var(--text-dim)]">Validator</span>
                                <span className="text-foreground">{stakeToUnstake.validator.moniker}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowUnstakeConfirm(false)}
                                className="py-4 bg-surfaceHighlight text-foreground rounded-2xl font-black text-sm hover:bg-border transition-all"
                            >Cancel</button>
                            <button
                                onClick={confirmUnstake}
                                className="py-4 bg-red-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all"
                            >Unstake</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xs px-4">
                {showToast && (
                    <Toast
                        message={toastMessage}
                        type={toastType}
                        onClose={() => setShowToast(false)}
                    />
                )}
            </div>
        </div>
    );
};
