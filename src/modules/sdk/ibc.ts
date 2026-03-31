import { REST_PROVIDERS } from './network';

export interface KnownIbcChainMeta {
    label: string;
    addressPrefix: string;
    restEndpoint: string;
    rpcEndpoint: string;
    nativeDenom: string;
    feeDenom: string;
    minGasPrice: number;
    iconText: string;
    chainRegistryName: string;
}

export interface IbcChannelOption {
    channelId: string;
    portId: string;
    counterpartyChannelId: string;
    counterpartyPortId: string;
    connectionId: string;
    state: string;
    chainId: string;
    label: string;
    prefixHints: string[];
    addressPrefix: string;
    knownMeta: KnownIbcChainMeta | null;
    expectedDestinationDenom: string;
    expectedDestinationTracePath: string;
    expectedDestinationSymbol: string;
    expectedDestinationDisplayName: string;
}

interface RawIbcChannelEntry {
    channelId: string;
    portId: string;
    counterpartyChannelId: string;
    counterpartyPortId: string;
    connectionId: string;
    state: string;
}

interface KnownIbcRoute {
    sourcePort: string;
    sourceChannel: string;
    counterpartyPort: string;
    counterpartyChannel: string;
    chainId: string;
    label: string;
    expectedDestinationDenom: string;
    expectedDestinationTracePath: string;
    expectedDestinationSymbol: string;
    expectedDestinationDisplayName: string;
}

export const KNOWN_IBC_CHAIN_METADATA: Record<string, KnownIbcChainMeta> = {
    'beezee-1': {
        label: 'BeeZee',
        addressPrefix: 'bze',
        restEndpoint: 'https://rest.getbze.com',
        rpcEndpoint: 'https://rpc.getbze.com',
        nativeDenom: 'ubze',
        feeDenom: 'ubze',
        minGasPrice: 0.01,
        iconText: 'BZE',
        chainRegistryName: 'beezee'
    },
    'bzetestnet-3': {
        label: 'BeeZee Testnet',
        addressPrefix: 'bze',
        restEndpoint: 'https://testnet.getbze.com',
        rpcEndpoint: 'https://testnet-rpc.getbze.com',
        nativeDenom: 'ubze',
        feeDenom: 'ubze',
        minGasPrice: 0.01,
        iconText: 'BZE',
        chainRegistryName: 'beezee'
    }
};

const LOCAL_NATIVE_DENOM = 'ulmn';
const BEEZEE_LMN_IBC_DENOM = 'ibc/693DDB2D9B4260D67C8136C22D837F37488E0FBD81857D8E9C6022332EA26E33';

const KNOWN_IBC_ROUTES: KnownIbcRoute[] = [
    {
        sourcePort: 'transfer',
        sourceChannel: 'channel-0',
        counterpartyPort: 'transfer',
        counterpartyChannel: 'channel-10',
        chainId: 'beezee-1',
        label: 'BeeZee (Route 10)',
        expectedDestinationDenom: BEEZEE_LMN_IBC_DENOM,
        expectedDestinationTracePath: 'transfer/channel-10',
        expectedDestinationSymbol: 'LMN',
        expectedDestinationDisplayName: 'LMN via IBC'
    }
];

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

function formatDenomSymbol(denom: string): string {
    const raw = String(denom || '').trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'ulmn') return 'LMN';
    if (raw === 'ubze') return 'BZE';
    if (raw.startsWith('u') && raw.length > 1) return raw.slice(1).toUpperCase();
    return raw.toUpperCase();
}

function getKnownIbcRoute(entry: RawIbcChannelEntry): KnownIbcRoute | null {
    return (
        KNOWN_IBC_ROUTES.find((route) =>
            route.sourcePort === entry.portId &&
            route.sourceChannel === entry.channelId &&
            (!route.counterpartyChannel || route.counterpartyChannel === entry.counterpartyChannelId)
        ) || null
    );
}

function buildRestUrl(base: string, path: string): string {
    return `${String(base || '').replace(/\/+$/, '')}${path}`;
}

async function fetchJson(url: string, timeoutMs: number): Promise<any> {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
        res = await fetch(url, {
            signal: controller.signal
        });
    } finally {
        globalThis.clearTimeout(timeoutId);
    }

    if (!res.ok) {
        throw new Error(`HTTP ${res.status} while fetching ${url}`);
    }

    return res.json();
}

export function getAddressPrefix(value: string): string {
    const raw = String(value || '').trim().toLowerCase();
    const match = raw.match(/^([a-z0-9]{1,24})1[ac-hj-np-z02-9]{6,}$/);
    return match ? match[1] : '';
}

export function isProbablyBech32Address(value: string): boolean {
    return !!getAddressPrefix(value);
}

export function getKnownIbcChainMeta(chainId: string): KnownIbcChainMeta | null {
    const normalized = String(chainId || '').trim();
    return normalized ? KNOWN_IBC_CHAIN_METADATA[normalized] || null : null;
}

export function derivePrefixHintsFromChainId(chainId: string): string[] {
    const raw = String(chainId || '').trim().toLowerCase();
    if (!raw) return [];

    const candidates = new Set<string>();
    const normalized = raw
        .replace(/(?:[_-]?testnet.*$)|(?:[_-]?mainnet.*$)|(?:[_-]?devnet.*$)|(?:[_-]?localnet.*$)|(?:[_-]?stage.*$)|(?:[_-]?alpha.*$)|(?:[_-]?beta.*$)/, '')
        .replace(/[_-]?\d+$/, '')
        .replace(/[_-]+$/, '');
    const firstToken = normalized.split(/[_-]/)[0] || normalized;

    for (const entry of [normalized, firstToken]) {
        const cleaned = entry.replace(/[^a-z0-9]/g, '');
        if (cleaned) candidates.add(cleaned);
    }

    if (raw.includes('bzetestnet') || raw.includes('beezee')) {
        candidates.add('bze');
    }

    return Array.from(candidates);
}

export function scoreIbcChannel(channel: IbcChannelOption, recipientPrefix: string): number {
    const prefix = String(recipientPrefix || '').trim().toLowerCase();
    if (!prefix) return 0;
    if (channel.prefixHints.includes(prefix)) return 100;
    if (channel.chainId.toLowerCase().includes(prefix)) return 40;
    if (channel.label.toLowerCase().includes(prefix)) return 10;
    return 0;
}

async function fetchOpenTransferChannels(forceSync = false): Promise<{ restEndpoint: string; channels: RawIbcChannelEntry[] }> {
    const candidateEndpoints = Array.from(
        new Set(
            REST_PROVIDERS
                .filter((provider) => provider.provider !== 'CosmosDirectory' && provider.provider !== 'Winnode')
                .map((provider) => provider.address)
        )
    );

    if (!candidateEndpoints.length) {
        throw new Error('No REST endpoints configured for IBC route discovery.');
    }

    let winner: { restEndpoint: string; payload: any[] };
    try {
        winner = await Promise.any(
            candidateEndpoints.map(async (restEndpoint) => {
                const data = await fetchJson(
                    buildRestUrl(restEndpoint, '/ibc/core/channel/v1/channels?pagination.limit=200'),
                    forceSync ? 12000 : 7000
                );
                return {
                    restEndpoint,
                    payload: Array.isArray(data?.channels) ? data.channels : []
                };
            })
        );
    } catch (error: any) {
        const firstReason = error?.errors?.[0];
        const detail = firstReason instanceof Error ? firstReason.message : String(firstReason || error?.message || error || '');
        throw new Error(detail ? `Failed to load IBC routes: ${detail}` : 'Failed to load IBC routes.');
    }

    const restEndpoint = winner.restEndpoint;
    const payload = winner.payload;

    const channels = payload
        .map((entry) => {
            const counterparty = entry?.counterparty || {};
            return {
                channelId: String(entry?.channel_id ?? entry?.channelId ?? '').trim(),
                portId: String(entry?.port_id ?? entry?.portId ?? 'transfer').trim() || 'transfer',
                counterpartyChannelId: String(counterparty?.channel_id ?? counterparty?.channelId ?? '').trim(),
                counterpartyPortId: String(counterparty?.port_id ?? counterparty?.portId ?? '').trim(),
                connectionId: String(entry?.connection_hops?.[0] ?? entry?.connectionHops?.[0] ?? '').trim(),
                state: String(entry?.state || '').trim().toUpperCase()
            };
        })
        .filter((entry) => {
            if (!entry.channelId) return false;
            if (entry.state && entry.state !== 'STATE_OPEN' && entry.state !== 'OPEN') return false;
            return entry.portId === 'transfer';
        });

    return { restEndpoint, channels };
}

function toBasicIbcChannel(entry: RawIbcChannelEntry): IbcChannelOption {
    const knownRoute = getKnownIbcRoute(entry);
    const knownMeta = knownRoute ? getKnownIbcChainMeta(knownRoute.chainId) : null;

    return {
        ...entry,
        chainId: knownRoute?.chainId || '',
        label: knownRoute?.label || (
            entry.counterpartyChannelId
                ? `Route ${entry.counterpartyChannelId.replace(/^channel-/, '')}`
                : entry.channelId
        ),
        prefixHints: knownMeta?.addressPrefix ? [knownMeta.addressPrefix] : [],
        addressPrefix: knownMeta?.addressPrefix || '',
        knownMeta,
        expectedDestinationDenom: knownRoute?.expectedDestinationDenom || '',
        expectedDestinationTracePath: knownRoute?.expectedDestinationTracePath || '',
        expectedDestinationSymbol: knownRoute?.expectedDestinationSymbol || '',
        expectedDestinationDisplayName: knownRoute?.expectedDestinationDisplayName || ''
    };
}

export async function enrichIbcChannel(channel: IbcChannelOption, forceSync = false): Promise<IbcChannelOption> {
    if (channel.knownMeta && channel.chainId) {
        return channel;
    }

    const { restEndpoint } = await fetchOpenTransferChannels(forceSync);
    let chainId = '';

    try {
        const clientData = await fetchJson(
            buildRestUrl(
                restEndpoint,
                `/ibc/core/channel/v1/channels/${encodeURIComponent(channel.channelId)}/ports/${encodeURIComponent(channel.portId)}/client_state`
            ),
            3500
        );

        chainId = String(
            clientData?.identified_client_state?.client_state?.chain_id ||
            clientData?.identified_client_state?.client_state?.chainId ||
            clientData?.client_state?.chain_id ||
            clientData?.client_state?.chainId ||
            ''
        ).trim();
    } catch {
        chainId = '';
    }

    const knownMeta = getKnownIbcChainMeta(chainId);
    const prefixHints = Array.from(
        new Set([
            ...(knownMeta?.addressPrefix ? [knownMeta.addressPrefix] : []),
            ...derivePrefixHintsFromChainId(chainId)
        ])
    );

    const label = knownMeta
        ? knownMeta.label
        : chainId
            ? chainId
            : channel.counterpartyChannelId
                ? `${channel.channelId} -> ${channel.counterpartyChannelId}`
                : channel.channelId;

    let expectedDestinationTracePath = '';
    let expectedDestinationDenom = '';
    let expectedDestinationSymbol = '';
    let expectedDestinationDisplayName = '';

    if (channel.counterpartyChannelId) {
        expectedDestinationTracePath = `${channel.counterpartyPortId || 'transfer'}/${channel.counterpartyChannelId}`;
        expectedDestinationDenom = await computeIbcDenom(expectedDestinationTracePath, LOCAL_NATIVE_DENOM);
        expectedDestinationSymbol = formatDenomSymbol(LOCAL_NATIVE_DENOM);
        expectedDestinationDisplayName = expectedDestinationSymbol
            ? `${expectedDestinationSymbol} via IBC`
            : 'IBC Asset';
    }

    return {
        ...channel,
        chainId,
        label,
        prefixHints,
        addressPrefix: knownMeta?.addressPrefix || prefixHints[0] || '',
        knownMeta,
        expectedDestinationDenom,
        expectedDestinationTracePath,
        expectedDestinationSymbol,
        expectedDestinationDisplayName
    };
}

export async function fetchIbcChannels(forceSync = false): Promise<IbcChannelOption[]> {
    const { channels } = await fetchOpenTransferChannels(forceSync);
    return channels
        .map((entry) => toBasicIbcChannel(entry))
        .sort((a, b) => a.label.localeCompare(b.label));
}
