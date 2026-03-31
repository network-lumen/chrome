import { KeyManager, type LumenWallet } from '../sdk/key-manager';
import { NetworkManager } from '../sdk/network';
import { fetchIbcChannels, type IbcChannelOption, type KnownIbcChainMeta } from '../sdk/ibc';

export interface AssetTransferTarget {
    key: string;
    chainId: string;
    chainLabel: string;
    addressPrefix: string;
    defaultRecipient: string;
    sourceChannel: string;
    sourcePort: string;
    routeLabel: string;
}

export interface CrossChainAssetRow {
    id: string;
    chainId: string;
    chainLabel: string;
    ownerAddress: string;
    addressPrefix: string;
    denom: string;
    microAmount: string;
    displayAmount: string;
    displayName: string;
    displaySymbol: string;
    traceLabel: string;
    routeLabel: string;
    sendEnabled: boolean;
    transferEnabled: boolean;
    transferTargets: AssetTransferTarget[];
    restEndpoint: string;
    rpcEndpoint: string;
    feeDenom: string;
    minGasPrice: number;
    isLocal: boolean;
    error: string;
}

const denomTraceCache = new Map<string, { baseDenom: string; path: string } | null>();
const remoteVoucherCandidateCache = new Map<string, string[]>();

function trimTrailingSlash(value: string): string {
    return String(value || '').replace(/\/+$/, '');
}

function buildAbsoluteUrl(base: string, path: string): string {
    return `${trimTrailingSlash(base)}${path}`;
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

async function computeIbcDenom(path: string, baseDenom: string): Promise<string> {
    const trace = `${String(path || '').trim()}/${String(baseDenom || '').trim()}`.replace(/^\/+/, '');
    const encoded = new TextEncoder().encode(trace);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return `ibc/${bytesToHex(new Uint8Array(digest))}`;
}

function getAddressPrefix(value: string): string {
    const raw = String(value || '').trim().toLowerCase();
    const match = raw.match(/^([a-z0-9]{1,24})1[ac-hj-np-z02-9]{6,}$/);
    return match ? match[1] : '';
}

function shortenAddress(value: string): string {
    const raw = String(value || '').trim();
    if (raw.length <= 16) return raw;
    return `${raw.slice(0, 10)}...${raw.slice(-6)}`;
}

function formatAssetAmount(amount: string): string {
    const raw = Number(amount || '0');
    if (!Number.isFinite(raw)) return '0';
    return (raw / 1_000_000).toFixed(6).replace(/\.?0+$/, '') || '0';
}

function formatBaseDenomSymbol(denom: string): string {
    const raw = String(denom || '').trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'ulmn') return 'LMN';
    if (raw === 'ubze') return 'BZE';
    if (raw === 'uusdc') return 'USDC';
    if (raw.startsWith('u') && raw.length > 1) return raw.slice(1).toUpperCase();
    if (raw.startsWith('factory/')) {
        const tail = raw.split('/').pop() || raw;
        return tail.toUpperCase();
    }
    if (raw.startsWith('ibc/')) return 'IBC';
    return raw.toUpperCase();
}

function buildAssetDisplayName(rawDenom: string, displaySymbol: string, trace: { baseDenom: string; path: string } | null): string {
    const lower = String(rawDenom || '').trim().toLowerCase();
    if (trace?.baseDenom) return `${displaySymbol} via IBC`;
    if (lower === 'ulmn') return 'Lumen';
    if (lower === 'ubze') return 'BeeZee';
    if (lower === 'uusdc') return 'USDC';
    if (lower.startsWith('ibc/')) return `${displaySymbol} (IBC)`;
    return displaySymbol || rawDenom;
}

async function fetchJson(url: string, timeoutMs: number): Promise<any> {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
        res = await fetch(url, { signal: controller.signal });
    } finally {
        globalThis.clearTimeout(timeoutId);
    }

    if (!res.ok) {
        throw new Error(`HTTP ${res.status} while fetching ${url}`);
    }

    return res.json();
}

async function fetchLocalBalances(ownerAddress: string): Promise<Array<{ denom: string; amount: string }>> {
    const endpoint = NetworkManager.getInstance().getQuickRestEndpoint();
    const data = await fetchJson(`${endpoint}/cosmos/bank/v1beta1/balances/${encodeURIComponent(ownerAddress)}`, 12000);
    const balances = Array.isArray(data?.balances) ? data.balances : [];
    return balances.map((coin: any) => ({
        denom: String(coin?.denom || '').trim(),
        amount: String(coin?.amount || '0').trim() || '0'
    }));
}

async function fetchRemoteBalances(restEndpoint: string, ownerAddress: string): Promise<Array<{ denom: string; amount: string }>> {
    const data = await fetchJson(
        buildAbsoluteUrl(restEndpoint, `/cosmos/bank/v1beta1/balances/${encodeURIComponent(ownerAddress)}`),
        12000
    );
    const balances = Array.isArray(data?.balances) ? data.balances : [];
    return balances.map((coin: any) => ({
        denom: String(coin?.denom || '').trim(),
        amount: String(coin?.amount || '0').trim() || '0'
    }));
}

async function fetchRemoteBalanceByDenom(
    restEndpoint: string,
    ownerAddress: string,
    denom: string
): Promise<{ denom: string; amount: string } | null> {
    const rawDenom = String(denom || '').trim();
    if (!rawDenom) return null;

    try {
        const data = await fetchJson(
            buildAbsoluteUrl(
                restEndpoint,
                `/cosmos/bank/v1beta1/balances/${encodeURIComponent(ownerAddress)}/by_denom?denom=${encodeURIComponent(rawDenom)}`
            ),
            12000
        );
        const balance = data?.balance || null;
        if (!balance) return null;

        return {
            denom: String(balance?.denom || rawDenom).trim() || rawDenom,
            amount: String(balance?.amount || '0').trim() || '0'
        };
    } catch {
        return null;
    }
}

async function fetchRemoteVoucherCandidates(
    restEndpoint: string,
    sourceChainId: string,
    baseDenom: string
): Promise<string[]> {
    const normalizedSourceChainId = String(sourceChainId || '').trim().toLowerCase();
    const normalizedBaseDenom = String(baseDenom || '').trim().toLowerCase();
    if (!normalizedSourceChainId || !normalizedBaseDenom) return [];

    const cacheKey = `${trimTrailingSlash(restEndpoint)}|${normalizedSourceChainId}|${normalizedBaseDenom}`;
    if (remoteVoucherCandidateCache.has(cacheKey)) {
        return remoteVoucherCandidateCache.get(cacheKey) || [];
    }

    try {
        const data = await fetchJson(
            buildAbsoluteUrl(restEndpoint, '/ibc/core/channel/v1/channels?pagination.limit=200'),
            12000
        );

        const channels = (Array.isArray(data?.channels) ? data.channels : [])
            .map((entry: any) => ({
                channelId: String(entry?.channel_id || '').trim(),
                portId: String(entry?.port_id || 'transfer').trim() || 'transfer',
                state: String(entry?.state || '').trim().toUpperCase()
            }))
            .filter((entry: { channelId: string; portId: string; state: string }) => entry.channelId && entry.portId === 'transfer');

        const candidateDenoms = await Promise.all(
            channels.map(async (entry: { channelId: string; portId: string; state: string }) => {
                try {
                    const clientState = await fetchJson(
                        buildAbsoluteUrl(
                            restEndpoint,
                            `/ibc/core/channel/v1/channels/${encodeURIComponent(entry.channelId)}/ports/${encodeURIComponent(entry.portId)}/client_state`
                        ),
                        6000
                    );

                    const chainId = String(
                        clientState?.identified_client_state?.client_state?.chain_id ||
                        clientState?.identified_client_state?.client_state?.chainId ||
                        clientState?.client_state?.chain_id ||
                        clientState?.client_state?.chainId ||
                        ''
                    ).trim().toLowerCase();

                    if (!chainId || (chainId !== normalizedSourceChainId && !chainId.startsWith(`${normalizedSourceChainId}-`))) {
                        return '';
                    }

                    return computeIbcDenom(`${entry.portId}/${entry.channelId}`, baseDenom);
                } catch {
                    return '';
                }
            })
        );

        const deduped = Array.from(new Set(candidateDenoms.filter(Boolean)));
        remoteVoucherCandidateCache.set(cacheKey, deduped);
        return deduped;
    } catch {
        remoteVoucherCandidateCache.set(cacheKey, []);
        return [];
    }
}

async function resolveDenomTrace(
    restEndpoint: string,
    denom: string,
    { isLocal = false }: { isLocal?: boolean } = {}
): Promise<{ baseDenom: string; path: string } | null> {
    const rawDenom = String(denom || '').trim();
    if (!rawDenom || !rawDenom.toUpperCase().startsWith('IBC/')) return null;

    const hash = rawDenom.slice(4);
    const cacheKey = `${isLocal ? '__local__' : trimTrailingSlash(restEndpoint)}|${hash}`;
    if (denomTraceCache.has(cacheKey)) {
        return denomTraceCache.get(cacheKey) || null;
    }

    try {
        const data = isLocal
            ? await fetchJson(
                `${NetworkManager.getInstance().getQuickRestEndpoint()}/ibc/apps/transfer/v1/denom_traces/${encodeURIComponent(hash)}`,
                10000
            )
            : await fetchJson(
                buildAbsoluteUrl(restEndpoint, `/ibc/apps/transfer/v1/denom_traces/${encodeURIComponent(hash)}`),
                10000
            );

        const trace = data?.denom_trace || data?.denomTrace || null;
        const resolved = trace
            ? {
                baseDenom: String(trace?.base_denom || trace?.baseDenom || '').trim(),
                path: String(trace?.path || '').trim()
            }
            : null;
        denomTraceCache.set(cacheKey, resolved);
        return resolved;
    } catch {
        denomTraceCache.set(cacheKey, null);
        return null;
    }
}

function resolveKnownChainMeta(channel: IbcChannelOption): KnownIbcChainMeta | null {
    return channel.knownMeta || null;
}

async function createAssetRow(input: {
    chainId: string;
    chainLabel: string;
    ownerAddress: string;
    coin: { denom: string; amount: string };
    transferTargets: AssetTransferTarget[];
    routeLabel: string;
    restEndpoint: string;
    rpcEndpoint: string;
    feeDenom: string;
    minGasPrice: number;
    isLocal: boolean;
    error?: string;
}): Promise<CrossChainAssetRow> {
    const rawDenom = String(input.coin?.denom || '').trim();
    const rawAmount = String(input.coin?.amount || '0').trim() || '0';
    const trace = rawDenom
        ? await resolveDenomTrace(input.restEndpoint, rawDenom, { isLocal: input.isLocal })
        : null;
    const baseDenom = trace?.baseDenom || rawDenom;
    const displaySymbol = formatBaseDenomSymbol(baseDenom);
    const displayName = buildAssetDisplayName(rawDenom, displaySymbol, trace);
    const addressPrefix = getAddressPrefix(input.ownerAddress);
    const sendEnabled = BigInt(rawAmount || '0') > 0n;
    const transferEnabled = input.transferTargets.length > 0 && BigInt(rawAmount || '0') > 0n;

    return {
        id: `${input.chainId}:${rawDenom || 'unknown'}`,
        chainId: input.chainId,
        chainLabel: input.chainLabel,
        ownerAddress: input.ownerAddress,
        addressPrefix,
        denom: rawDenom,
        microAmount: rawAmount,
        displayAmount: formatAssetAmount(rawAmount),
        displayName,
        displaySymbol,
        traceLabel: trace?.path ? `Trace: ${trace.path}` : '',
        routeLabel: input.routeLabel,
        sendEnabled,
        transferEnabled,
        transferTargets: input.transferTargets,
        restEndpoint: input.restEndpoint,
        rpcEndpoint: input.rpcEndpoint,
        feeDenom: input.feeDenom,
        minGasPrice: input.minGasPrice,
        isLocal: input.isLocal,
        error: String(input.error || '')
    };
}

export async function loadCrossChainAssets(wallet: LumenWallet): Promise<{ rows: CrossChainAssetRow[]; errors: string[] }> {
    denomTraceCache.clear();
    remoteVoucherCandidateCache.clear();

    const localChainId = 'lumen';
    const localChainLabel = 'Lumen';
    const localRestEndpoint = NetworkManager.getInstance().getQuickRestEndpoint();

    const ibcChannels = await fetchIbcChannels(true);
    const linkedChains = Array.from(
        ibcChannels.reduce((map, channel) => {
            const key = channel.chainId || channel.channelId;
            if (map.has(key)) return map;

            const meta = resolveKnownChainMeta(channel);
            if (!meta?.addressPrefix) return map;

            map.set(key, { channel, meta });
            return map;
        }, new Map<string, { channel: IbcChannelOption; meta: KnownIbcChainMeta }>())
    ).map(([, value]) => value);

    const linkedChainAddresses = await Promise.all(
        linkedChains.map(async (entry) => ({
            ...entry,
            ownerAddress: await KeyManager.deriveAddressWithPrefix(wallet.mnemonic, entry.meta.addressPrefix)
        }))
    );

    const outboundTargets: AssetTransferTarget[] = linkedChainAddresses.map((entry) => ({
        key: `${entry.channel.chainId}:${entry.channel.channelId}`,
        chainId: entry.channel.chainId,
        chainLabel: entry.channel.label || entry.meta.label,
        addressPrefix: entry.meta.addressPrefix,
        defaultRecipient: entry.ownerAddress,
        sourceChannel: entry.channel.channelId,
        sourcePort: entry.channel.portId,
        routeLabel: `${entry.meta.label} (${entry.channel.channelId.replace(/^channel-/, 'Route ')})`
    }));

    const localBalances = await fetchLocalBalances(wallet.address);
    const localCoins = localBalances.length ? localBalances : [{ denom: 'ulmn', amount: '0' }];
    const localRows = await Promise.all(
        localCoins.map((coin) =>
            createAssetRow({
                chainId: localChainId,
                chainLabel: localChainLabel,
                ownerAddress: wallet.address,
                coin,
                transferTargets: outboundTargets,
                routeLabel: outboundTargets.length
                    ? `Available to: ${outboundTargets.map((target) => target.chainLabel).join(', ')}`
                    : 'No linked chain available.',
                restEndpoint: localRestEndpoint,
                rpcEndpoint: '',
                feeDenom: 'ulmn',
                minGasPrice: 0,
                isLocal: true
            })
        )
    );

    const errors: string[] = [];
    const remoteRowsNested = await Promise.all(
        linkedChainAddresses.map(async (entry) => {
            const remoteChainId = entry.channel.chainId || entry.channel.channelId;
            const returnTargets: AssetTransferTarget[] =
                entry.channel.counterpartyChannelId
                    ? [
                        {
                            key: `${localChainId}:${entry.channel.counterpartyChannelId}`,
                            chainId: localChainId,
                            chainLabel: localChainLabel,
                            addressPrefix: 'lmn',
                            defaultRecipient: wallet.address,
                            sourceChannel: entry.channel.counterpartyChannelId,
                            sourcePort: entry.channel.counterpartyPortId || 'transfer',
                            routeLabel: `Lumen (${(entry.channel.counterpartyChannelId || '').replace(/^channel-/, 'Route ')})`
                        }
                    ]
                    : [];

            const fallbackCoin = { denom: entry.meta.nativeDenom, amount: '0' };
            const discoveredVoucherDenoms = await fetchRemoteVoucherCandidates(
                entry.meta.restEndpoint,
                localChainId,
                'ulmn'
            );
            const expectedRemoteDenoms = Array.from(
                new Set([
                    String(entry.channel.expectedDestinationDenom || '').trim(),
                    ...discoveredVoucherDenoms
                ].filter(Boolean))
            );

            try {
                const balances = await fetchRemoteBalances(entry.meta.restEndpoint, entry.ownerAddress);
                const supplementalBalances = await Promise.all(
                    expectedRemoteDenoms
                        .filter((denom) => !balances.some((coin) => coin.denom === denom))
                        .map((denom) => fetchRemoteBalanceByDenom(entry.meta.restEndpoint, entry.ownerAddress, denom))
                );

                const mergedBalances = [
                    ...balances,
                    ...supplementalBalances.filter((coin): coin is { denom: string; amount: string } => !!coin)
                ];
                const coins = mergedBalances.length ? mergedBalances : [fallbackCoin];

                return Promise.all(
                    coins.map((coin) =>
                        createAssetRow({
                            chainId: remoteChainId,
                            chainLabel: entry.meta.label,
                            ownerAddress: entry.ownerAddress,
                            coin,
                            transferTargets: returnTargets,
                            routeLabel: returnTargets.length
                                ? `Return path: ${returnTargets[0].routeLabel}`
                                : 'No return path configured.',
                            restEndpoint: entry.meta.restEndpoint,
                            rpcEndpoint: entry.meta.rpcEndpoint,
                            feeDenom: entry.meta.feeDenom,
                            minGasPrice: entry.meta.minGasPrice,
                            isLocal: false
                        })
                    )
                );
            } catch (error: any) {
                errors.push(`${entry.meta.label}: ${String(error?.message || error || 'Failed to load balances')}`);
                return [
                    await createAssetRow({
                        chainId: remoteChainId,
                        chainLabel: entry.meta.label,
                        ownerAddress: entry.ownerAddress,
                        coin: fallbackCoin,
                        transferTargets: returnTargets,
                        routeLabel: returnTargets.length
                            ? `Return path: ${returnTargets[0].routeLabel}`
                            : 'No return path configured.',
                        restEndpoint: entry.meta.restEndpoint,
                        rpcEndpoint: entry.meta.rpcEndpoint,
                        feeDenom: entry.meta.feeDenom,
                        minGasPrice: entry.meta.minGasPrice,
                        isLocal: false,
                        error: String(error?.message || error || 'Failed to load balances')
                    })
                ];
            }
        })
    );

    const rows = [...localRows, ...remoteRowsNested.flat()].sort((a, b) => {
        if (a.chainId !== b.chainId) {
            if (a.isLocal) return -1;
            if (b.isLocal) return 1;
            return a.chainLabel.localeCompare(b.chainLabel);
        }

        if (a.transferEnabled !== b.transferEnabled) {
            return a.transferEnabled ? -1 : 1;
        }

        return a.displayName.localeCompare(b.displayName);
    });

    return { rows, errors };
}

export function getAssetOwnerLabel(asset: CrossChainAssetRow): string {
    return `${shortenAddress(asset.ownerAddress)}${asset.addressPrefix ? ` · ${asset.addressPrefix.toUpperCase()}` : ''}`;
}
