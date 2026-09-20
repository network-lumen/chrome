import { NetworkManager } from './network';

/**
 * The slice of x/tokenomics params the wallet has to know about.
 *
 * Chain v2.0.0 started charging per-message fees in the ante — before the
 * message runs, and taken from the account balance rather than from the
 * transaction's fee field, which stays empty on this gasless chain. A wallet
 * that ignores them offers a "MAX" that cannot be paid for, because the amount
 * it fills in is exactly the balance and the ante needs a little more.
 *
 * Every one of these is votable, so they are read from the chain rather than
 * hardcoded. The defaults below are what v2.0.0's upgrade handler wrote, used
 * only when the query fails.
 */
export interface ChainFeeParams {
    /** Charged on MsgSend and MsgTransfer, per message. */
    transferFeeUlmn: bigint;
    /** Charged on MsgDelegate. */
    delegateFeeUlmn: bigint;
    /** Charged on MsgBeginRedelegate. */
    redelegateFeeUlmn: bigint;
    /** Smallest amount a transfer may carry. */
    minSendUlmn: bigint;
    /** Delegated stake an account needs before its vote is counted. */
    minVotingStakeUlmn: bigint;
    /** Transfer tax rate, charged to the *recipient*, as a fraction (0.01 = 1%). */
    txTaxRate: number;
    /** False when these are the fallbacks rather than what the chain reported. */
    fromChain: boolean;
}

export const FALLBACK_FEE_PARAMS: ChainFeeParams = {
    transferFeeUlmn: 1000n,
    delegateFeeUlmn: 1000n,
    redelegateFeeUlmn: 1000n,
    minSendUlmn: 1000n,
    minVotingStakeUlmn: 1_000_000n,
    txTaxRate: 0.01,
    fromChain: false
};

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: ChainFeeParams | null = null;
let cachedAt = 0;
let inFlight: Promise<ChainFeeParams> | null = null;

function toBigInt(value: unknown, fallback: bigint): bigint {
    if (value === null || value === undefined || value === '') return fallback;
    try {
        return BigInt(value as string);
    } catch {
        return fallback;
    }
}

/**
 * Reads the live fee parameters, cached for five minutes.
 *
 * Never rejects: a wallet that cannot reach the params endpoint should still be
 * able to send, using the shipped defaults. Callers that need to tell the user
 * whether the numbers are live read `fromChain`.
 */
export async function getChainFeeParams(forceRefresh = false): Promise<ChainFeeParams> {
    if (!forceRefresh && cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            const endpoint = await NetworkManager.getInstance().getRestEndpoint();
            const res = await fetch(`${endpoint}/lumen/tokenomics/v1/params`, {
                signal: AbortSignal.timeout(5000)
            });
            if (!res.ok) throw new Error(`params fetch failed: ${res.status}`);

            const params = (await res.json())?.params ?? {};
            const parsedRate = parseFloat(params.tx_tax_rate);

            const result: ChainFeeParams = {
                transferFeeUlmn: toBigInt(params.transfer_fee_ulmn, FALLBACK_FEE_PARAMS.transferFeeUlmn),
                delegateFeeUlmn: toBigInt(params.delegate_fee_ulmn, FALLBACK_FEE_PARAMS.delegateFeeUlmn),
                redelegateFeeUlmn: toBigInt(params.redelegate_fee_ulmn, FALLBACK_FEE_PARAMS.redelegateFeeUlmn),
                minSendUlmn: toBigInt(params.min_send_ulmn, FALLBACK_FEE_PARAMS.minSendUlmn),
                minVotingStakeUlmn: toBigInt(params.min_voting_stake_ulmn, FALLBACK_FEE_PARAMS.minVotingStakeUlmn),
                txTaxRate: Number.isFinite(parsedRate) ? parsedRate : FALLBACK_FEE_PARAMS.txTaxRate,
                fromChain: true
            };

            cached = result;
            cachedAt = Date.now();
            return result;
        } catch (error) {
            console.warn('[chain-params] falling back to shipped defaults:', error);
            /* Serve a previously good read rather than the defaults when one exists. */
            return cached ?? FALLBACK_FEE_PARAMS;
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

/**
 * What is left of `balanceUlmn` once the fee for one priced message is paid.
 * Returns 0n rather than a negative when the balance cannot cover the fee.
 */
export function spendableAfterFee(balanceUlmn: bigint, feeUlmn: bigint): bigint {
    const remainder = balanceUlmn - feeUlmn;
    return remainder > 0n ? remainder : 0n;
}
