import { MsgDelegate, MsgUndelegate } from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import { MsgWithdrawDelegatorReward } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { Any } from 'cosmjs-types/google/protobuf/any';
import type { LumenWallet } from './key-manager';

import { NetworkManager } from './network';
import { buildAndSignTx, broadcastTx, waitForTxCommit } from './tx';

const GAS_LIMIT = BigInt(300000);

/**
 * The chain refuses a transaction carrying more than this many messages
 * (app/ante_max_messages.go). Claiming rewards from more validators than that
 * is split across several transactions.
 */
export const MAX_MESSAGES_PER_TX = 64;

/* Helper: sign + broadcast a set of messages as one gasless transaction */
async function submit(walletData: LumenWallet, messages: Any[], memo: string): Promise<string> {
    /* Sync RPCs */
    await NetworkManager.getInstance().sync();

    const { txBytes, endpoint } = await buildAndSignTx({
        walletData,
        messages,
        memo,
        gasLimit: GAS_LIMIT * BigInt(Math.max(1, messages.length))
    });

    return broadcastTx(txBytes, endpoint);
}

/* Fetch Delegations */
export async function fetchDelegations(delegatorAddress: string) {
    try {
        const endpoint = await NetworkManager.getInstance().getRestEndpoint();
        const res = await fetch(`${endpoint}/cosmos/staking/v1beta1/delegations/${delegatorAddress}`);
        if (!res.ok) {
            if (res.status === 404) return [];
            throw new Error(`Failed to fetch delegations: ${res.status}`);
        }
        const data = await res.json();
        return data.delegation_responses || [];
    } catch (error) {
        console.error('Error fetching delegations:', error);
        return [];
    }
}

/* Fetch Unbonding Delegations */
export async function fetchUnbondingDelegations(delegatorAddress: string) {
    try {
        const endpoint = await NetworkManager.getInstance().getRestEndpoint();
        const res = await fetch(`${endpoint}/cosmos/staking/v1beta1/delegators/${delegatorAddress}/unbonding_delegations`);
        if (!res.ok) {
            if (res.status === 404) return [];
            throw new Error(`Failed to fetch unbonding delegations: ${res.status}`);
        }
        const data = await res.json();
        return data.unbonding_responses || [];
    } catch (error) {
        console.error('Error fetching unbonding delegations:', error);
        return [];
    }
}

/* Fetch Rewards */
export async function fetchRewards(delegatorAddress: string) {
    try {
        const endpoint = await NetworkManager.getInstance().getRestEndpoint();
        const res = await fetch(`${endpoint}/cosmos/distribution/v1beta1/delegators/${delegatorAddress}/rewards`);
        if (!res.ok) {
            if (res.status === 404) return { total: [], rewards: [] };
            throw new Error(`Failed to fetch rewards: ${res.status}`);
        }
        const data = await res.json();
        return {
            total: data.total || [],
            rewards: data.rewards || []
        };
    } catch (error) {
        console.error('Error fetching rewards:', error);
        return { total: [], rewards: [] };
    }
}

/* Fetch Validators */
export async function fetchValidators() {
    try {
        const endpoint = await NetworkManager.getInstance().getRestEndpoint();
        const res = await fetch(`${endpoint}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=500`);
        if (!res.ok) {
            throw new Error(`Failed to fetch validators: ${res.status}`);
        }
        const data = await res.json();
        return data.validators || [];
    } catch (error) {
        console.error('Error fetching validators:', error);
        return [];
    }
}

/**
 * Fetch every validator regardless of bonding status.
 *
 * The staking dashboard resolves the validator behind each delegation from this
 * list. Filtering to bonded ones would leave a delegation to a jailed or
 * unbonding validator with no moniker, and the dashboard drops stakes it cannot
 * name — so the stake would vanish from the UI while the tokens are still
 * delegated.
 */
export async function fetchAllValidators() {
    try {
        const endpoint = await NetworkManager.getInstance().getRestEndpoint();
        const res = await fetch(`${endpoint}/cosmos/staking/v1beta1/validators?pagination.limit=500`);
        if (!res.ok) {
            throw new Error(`Failed to fetch validators: ${res.status}`);
        }
        const data = await res.json();
        return data.validators || [];
    } catch (error) {
        console.error('Error fetching validators:', error);
        return [];
    }
}

/* Fetch Validator Info */
export async function fetchValidator(validatorAddress: string) {
    try {
        const endpoint = await NetworkManager.getInstance().getRestEndpoint();
        const res = await fetch(`${endpoint}/cosmos/staking/v1beta1/validators/${validatorAddress}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch validator: ${res.status}`);
        }
        const data = await res.json();
        return data.validator;
    } catch (error) {
        console.error('Error fetching validator:', error);
        return null;
    }
}

/* Fetch spendable balance in ulmn */
export async function fetchBalanceUlmn(address: string): Promise<string> {
    try {
        const endpoint = await NetworkManager.getInstance().getRestEndpoint();
        const res = await fetch(`${endpoint}/cosmos/bank/v1beta1/balances/${address}`);
        if (!res.ok) return '0';
        const data = await res.json();
        return data.balances?.find((b: any) => b.denom === 'ulmn')?.amount || '0';
    } catch (error) {
        console.error('Error fetching balance:', error);
        return '0';
    }
}

/* Delegate Tokens */
export async function delegateTokens(
    walletData: LumenWallet,
    validatorAddress: string,
    amountUlmn: string
): Promise<string> {
    const msgAny = Any.fromPartial({
        typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
        value: MsgDelegate.encode({
            delegatorAddress: walletData.address,
            validatorAddress,
            amount: { denom: 'ulmn', amount: amountUlmn }
        }).finish()
    });

    return submit(walletData, [msgAny], `Stake ${amountUlmn} ulmn`);
}

/* Undelegate Tokens */
export async function undelegateTokens(
    walletData: LumenWallet,
    validatorAddress: string,
    amountUlmn: string
): Promise<string> {
    const msgAny = Any.fromPartial({
        typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
        value: MsgUndelegate.encode({
            delegatorAddress: walletData.address,
            validatorAddress,
            amount: { denom: 'ulmn', amount: amountUlmn }
        }).finish()
    });

    return submit(walletData, [msgAny], `Unstake ${amountUlmn} ulmn`);
}

function withdrawMsg(delegatorAddress: string, validatorAddress: string): Any {
    return Any.fromPartial({
        typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
        value: MsgWithdrawDelegatorReward.encode({
            delegatorAddress,
            validatorAddress
        }).finish()
    });
}

/* Claim Rewards from a single validator */
export async function claimRewards(
    walletData: LumenWallet,
    validatorAddress: string
): Promise<string> {
    return submit(
        walletData,
        [withdrawMsg(walletData.address, validatorAddress)],
        'Claim staking rewards'
    );
}

/**
 * Claim rewards from several validators at once.
 *
 * One MsgWithdrawDelegatorReward per validator, bundled into as few
 * transactions as the 64-message cap allows. Withdrawing rewards is not a
 * priced message, so the bundle costs the user nothing beyond the signature.
 *
 * Transactions are broadcast one after another rather than in parallel: they
 * share an account sequence, and two in flight at once means the second is
 * rejected for reusing a sequence number.
 */
export async function claimAllRewards(
    walletData: LumenWallet,
    validatorAddresses: string[]
): Promise<string[]> {
    if (validatorAddresses.length === 0) {
        throw new Error('No rewards to claim.');
    }

    const hashes: string[] = [];

    for (let i = 0; i < validatorAddresses.length; i += MAX_MESSAGES_PER_TX) {
        const batch = validatorAddresses.slice(i, i + MAX_MESSAGES_PER_TX);
        const messages = batch.map((addr) => withdrawMsg(walletData.address, addr));
        const hash = await submit(walletData, messages, `Claim rewards from ${batch.length} validators`);
        hashes.push(hash);

        /* The next batch reads its sequence number off the account, which only
           advances once this one is in a block. */
        const isLast = i + MAX_MESSAGES_PER_TX >= validatorAddresses.length;
        if (!isLast) await waitForTxCommit(hash);
    }

    return hashes;
}
