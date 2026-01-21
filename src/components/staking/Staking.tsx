import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Award, Users, ChevronRight, RefreshCw } from 'lucide-react';
import type { LumenWallet } from '../../modules/sdk/key-manager';
import { Toast } from '../common/Toast';
import { 
    fetchDelegations, 
    fetchRewards, 
    fetchValidators,
    fetchValidator,
    delegateTokens,
    undelegateTokens,
    claimRewards
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
            const txHash = await delegateTokens(walletKeys, selectedValidator.address, amountUlmn);
            
            setToastMessage(`Staked successfully! TX: ${txHash.slice(0, 8)}...`);
            setToastType('success');
            setShowToast(true);
            setAmount('');
            setSelectedValidator(null);
            
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
        if (!walletKeys) return;
        setLoading(true);
        
        try {
            const amountUlmn = (parseFloat(stake.amount) * 1000000).toString();
            const txHash = await undelegateTokens(walletKeys, stake.validatorAddress, amountUlmn);
            
            setToastMessage(`Unstaked successfully! TX: ${txHash.slice(0, 8)}...`);
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
        }
    };

    const handleClaimRewards = async (validatorAddress: string) => {
        if (!walletKeys) return;
        setLoading(true);
        
        try {
            const txHash = await claimRewards(walletKeys, validatorAddress);
            
            setToastMessage(`Rewards claimed! TX: ${txHash.slice(0, 8)}...`);
            setToastType('success');
            setShowToast(true);
            
            // Refresh data
            await fetchUserStakingData();
        } catch (error: any) {
            console.error('Claim rewards error:', error);
            setToastMessage(error.message || 'Failed to claim rewards');
            setToastType('error');
            setShowToast(true);
        } finally {
            setLoading(false);
        }
    };

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
                <h1 className="text-lg font-bold text-foreground">Staking</h1>
                <button
                    onClick={fetchUserStakingData}
                    disabled={fetching}
                    className="p-2 hover:bg-surfaceHighlight rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 disabled:scale-100"
                >
                    <RefreshCw className={`w-5 h-5 text-foreground transition-transform ${fetching ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 p-4">
                <div className="bg-gradient-to-br from-surface to-surfaceHighlight border border-border rounded-2xl p-3 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">APR</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">12.5%</p>
                </div>
                <div className="bg-gradient-to-br from-surface to-surfaceHighlight border border-border rounded-2xl p-3 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-2">
                        <Award className="w-4 h-4 text-lumen" />
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Staked</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{totalStaked} LMN</p>
                </div>
                <div className="bg-gradient-to-br from-surface to-surfaceHighlight border border-border rounded-2xl p-3 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-green-500" />
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Rewards</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{totalRewards} LMN</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-4 mb-4">
                <button
                    onClick={() => setActiveTab('stake')}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-300 ${
                        activeTab === 'stake'
                            ? 'bg-primary text-white scale-105'
                            : 'bg-surface text-[var(--text-muted)] hover:bg-surfaceHighlight hover:scale-105'
                    }`}
                >
                    Stake
                </button>
                <button
                    onClick={() => setActiveTab('unstake')}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-300 ${
                        activeTab === 'unstake'
                            ? 'bg-primary text-white scale-105'
                            : 'bg-surface text-[var(--text-muted)] hover:bg-surfaceHighlight hover:scale-105'
                    }`}
                >
                    Unstake
                </button>
                <button
                    onClick={() => setActiveTab('rewards')}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-300 ${
                        activeTab === 'rewards'
                            ? 'bg-primary text-white scale-105'
                            : 'bg-surface text-[var(--text-muted)] hover:bg-surfaceHighlight hover:scale-105'
                    }`}
                >
                    Rewards
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-3 pb-3">
                {activeTab === 'stake' && (
                    <div className="space-y-3">
                        {hasStakes ? (
                            /* Show User's Stakes */
                            <div>
                                <h3 className="text-xs font-semibold text-foreground mb-2">Your Stakes</h3>
                                <div className="space-y-2">
                                    {userStakes.map((stake, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-surface border border-border rounded-2xl p-4 hover:border-primary/50 transition-all duration-300 hover:scale-[1.02]"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                                                        <Award className="w-3.5 h-3.5 text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm text-foreground">{stake.validator.moniker}</p>
                                                        <p className="text-[10px] text-[var(--text-muted)] font-mono">
                                                            {stake.validator.address.slice(0, 18)}...
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                                                <div>
                                                    <p className="text-[var(--text-dim)] mb-0.5">Staked</p>
                                                    <p className="font-semibold text-foreground">{stake.amount} LMN</p>
                                                </div>
                                                <div>
                                                    <p className="text-[var(--text-dim)] mb-0.5">Rewards</p>
                                                    <p className="font-semibold text-green-500">{stake.rewards} LMN</p>
                                                </div>
                                                <div>
                                                    <p className="text-[var(--text-dim)] mb-0.5">APR</p>
                                                    <p className="font-semibold text-primary">{stake.validator.apr}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Show Validator List for New Staking */
                            <>
                                {/* Amount Input */}
                                <div className="bg-surface border border-border rounded-lg p-3">
                                    <label className="text-[10px] font-medium text-[var(--text-muted)] mb-1.5 block uppercase">
                                        Amount to Stake
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="flex-1 bg-background border border-border rounded-lg p-2.5 text-foreground text-base font-semibold focus:border-primary outline-none transition-colors"
                                        />
                                        <span className="text-xs font-medium text-[var(--text-muted)]">LMN</span>
                                    </div>
                                    <button className="mt-1.5 text-[10px] text-primary font-semibold">
                                        Max
                                    </button>
                                </div>

                                {/* Validators List */}
                                <div>
                                    <h3 className="text-xs font-semibold text-foreground mb-2">Select Validator</h3>
                                    <div className="space-y-2">
                                        {validators.map((validator) => (
                                            <button
                                                key={validator.address}
                                                onClick={() => setSelectedValidator(validator)}
                                                className={`w-full bg-surface border rounded-lg p-3 transition-colors text-left ${
                                                    selectedValidator?.address === validator.address
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border hover:border-primary/50'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                                                            <Award className="w-3.5 h-3.5 text-white" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-sm text-foreground">{validator.moniker}</p>
                                                            <p className="text-[10px] text-[var(--text-muted)] font-mono">
                                                                {validator.address.slice(0, 18)}...
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                                    <div>
                                                        <p className="text-[var(--text-dim)] mb-0.5">Commission</p>
                                                        <p className="font-semibold text-foreground">{validator.commission}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[var(--text-dim)] mb-0.5">APR</p>
                                                        <p className="font-semibold text-green-500">{validator.apr}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[var(--text-dim)] mb-0.5">Voting Power</p>
                                                        <p className="font-semibold text-foreground">{validator.votingPower}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Stake Button */}
                                <button
                                    onClick={handleStake}
                                    disabled={!selectedValidator || !amount || loading}
                                    className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-hover hover:to-primary disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95"
                                >
                                    {loading ? 'Staking...' : 'Stake Now'}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'unstake' && (
                    <div className="space-y-2">
                        {fetching ? (
                            <div className="text-center py-10">
                                <RefreshCw className="w-10 h-10 text-primary mx-auto mb-2 animate-spin" />
                                <p className="text-sm text-[var(--text-muted)]">Loading stakes...</p>
                            </div>
                        ) : hasStakes ? (
                            userStakes.map((stake, idx) => (
                                <div key={idx} className="bg-surface border border-border rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                                                <Award className="w-3.5 h-3.5 text-white" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm text-foreground">{stake.validator.moniker}</p>
                                                <p className="text-[10px] text-[var(--text-muted)]">Staked: {stake.amount} LMN</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleUnstake(stake)}
                                        disabled={loading}
                                        className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg transition-colors"
                                    >
                                        {loading ? 'Unstaking...' : 'Unstake'}
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-sm text-[var(--text-muted)]">No active stakes</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'rewards' && (
                    <div className="space-y-2">
                        {fetching ? (
                            <div className="text-center py-10">
                                <RefreshCw className="w-10 h-10 text-primary mx-auto mb-2 animate-spin" />
                                <p className="text-sm text-[var(--text-muted)]">Loading rewards...</p>
                            </div>
                        ) : hasStakes ? (
                            userStakes.map((stake, idx) => (
                                <div key={idx} className="bg-surface border border-border rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                                                <Award className="w-3.5 h-3.5 text-white" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm text-foreground">{stake.validator.moniker}</p>
                                                <p className="text-[10px] text-green-500 font-semibold">+{stake.rewards} LMN</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleClaimRewards(stake.validatorAddress)}
                                        disabled={loading || parseFloat(stake.rewards) === 0}
                                        className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg transition-colors"
                                    >
                                        {loading ? 'Claiming...' : 'Claim Rewards'}
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-sm text-[var(--text-muted)]">No rewards available</p>
                            </div>
                        )}
                    </div>
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
