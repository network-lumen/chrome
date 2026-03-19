export interface Endpoint {
    address: string;
    provider: string;
}

/**
 * Source: https://github.com/cosmos/chain-registry/blob/master/lumen/chain.json
 */
export const RPC_PROVIDERS: Endpoint[] = [

    { address: "https://rpc.cosmos.directory/lumen", provider: "CosmosDirectory" },
    { address: "https://rpc.lumen.chaintools.tech", provider: "ChainTools" },
    { address: "https://lumen.blocksync.me/rpc", provider: "BlockSync" },
    { address: "https://lumen-mainnet-rpc.mekonglabs.com", provider: "MekongLabs" },
    { address: "https://rpc-lumen.onenov.xyz", provider: "OneNov" }
];

export const REST_PROVIDERS: Endpoint[] = [
    { address: "https://rest.cosmos.directory/lumen", provider: "CosmosDirectory" },
    { address: "https://lumen-api.node9x.com", provider: "node9x" },
    { address: "https://api.lumen.chaintools.tech", provider: "ChainTools" },
    { address: "https://lumen-mainnet-api.mekonglabs.com", provider: "MekongLabs" },
    { address: "https://api-lumen.winnode.xyz", provider: "Winnode" },
];

const CHAIN_ID = "lumen";

export class NetworkManager {
    private static instance: NetworkManager;
    private currentRpc: string = RPC_PROVIDERS[0].address;
    private currentRest: string = REST_PROVIDERS[0].address;
    private isAuto: boolean = true;
    private manualProvider: string | null = null;
    private lastUpdate: number = 0;
    private UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

    private constructor() {
        this.loadSettings();
    }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    private async loadSettings() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const settings = await chrome.storage.local.get(['rpc_settings']);
            const rpcSettings = settings.rpc_settings as { isAuto?: boolean; manualProvider?: string | null } | undefined;
            if (rpcSettings) {
                this.isAuto = rpcSettings.isAuto ?? true;
                this.manualProvider = rpcSettings.manualProvider ?? null;
                if (!this.isAuto && this.manualProvider) {
                    const rpc = RPC_PROVIDERS.find(p => p.provider === this.manualProvider);
                    const rest = REST_PROVIDERS.find(p => p.provider === this.manualProvider);
                    if (!rpc && !rest) {
                        this.isAuto = true;
                        this.manualProvider = null;
                        return;
                    }
                    if (rpc) this.currentRpc = rpc.address;
                    if (rest) this.currentRest = rest.address;
                }
            }
        }
    }

    public async saveSettings() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({
                rpc_settings: {
                    isAuto: this.isAuto,
                    manualProvider: this.manualProvider
                }
            });
        }
    }

    public async getRpcEndpoint(): Promise<string> {
        if (this.isAuto) {
            await this.refreshIfNecessary();
        }
        // If we have an RPC for the same provider as current REST, use it, otherwise fallback
        const currentProvider = REST_PROVIDERS.find(p => p.address === this.currentRest)?.provider;
        const matchingRpc = RPC_PROVIDERS.find(p => p.provider === currentProvider);
        return matchingRpc ? matchingRpc.address : this.currentRpc;
    }

    public async getRestEndpoint(forceSync: boolean = false): Promise<string> {
        if (this.isAuto) {
            await this.refreshIfNecessary(forceSync);
        }
        return this.currentRest;
    }

    /**
     * Returns the primary REST endpoint immediately for high-speed UI lookups (e.g. Balance).
     * Bypasses the consensus refresh wait.
     */
    public getQuickRestEndpoint(): string {
        return REST_PROVIDERS[0].address;
    }

    public async sync() {
        if (!this.isAuto) return;
        await this.refreshBestRpc(true);
    }

    public setAuto(auto: boolean) {
        this.isAuto = auto;
        if (auto) {
            this.refreshBestRpc(true);
        } else if (this.manualProvider) {
            const rest = REST_PROVIDERS.find(p => p.provider === this.manualProvider);
            if (rest) this.currentRest = rest.address;
        }
        this.saveSettings();
    }

    public setManualProvider(provider: string) {
        this.isAuto = false;
        this.manualProvider = provider;
        const rest = REST_PROVIDERS.find(p => p.provider === provider);
        if (rest) this.currentRest = rest.address;
        this.saveSettings();
    }

    public isAutoMode(): boolean {
        return this.isAuto;
    }

    public getSelectedProvider(): string | null {
        if (this.isAuto) return "Auto";
        return this.manualProvider;
    }

    private async refreshIfNecessary(force: boolean = false) {
        const now = Date.now();
        if (force || now - this.lastUpdate > this.UPDATE_INTERVAL) {
            await this.refreshBestRpc(force);
        }
    }

    public async refreshBestRpc(force: boolean = false) {
        if (!this.isAuto && !force) return;


        const results = await Promise.allSettled(
            REST_PROVIDERS.map(async (p) => {
                const start = Date.now();
                // 1. Fetch Latest Block
                const blockRes = await fetch(`${p.address.replace(/\/$/, '')}/cosmos/base/tendermint/v1beta1/blocks/latest`, {
                    signal: AbortSignal.timeout(3000)
                });
                if (!blockRes.ok) throw new Error('Block fetch failed');
                const blockData = await blockRes.json();
                const height = parseInt(blockData.block?.header?.height || "0");
                const chainId = blockData.block?.header?.chain_id;

                // 2. Fetch Syncing Status
                const syncRes = await fetch(`${p.address.replace(/\/$/, '')}/cosmos/base/tendermint/v1beta1/syncing`, {
                    signal: AbortSignal.timeout(2000)
                });
                let isSyncing = false;
                if (syncRes.ok) {
                    const syncData = await syncRes.json();
                    isSyncing = syncData.syncing === true;
                }

                return {
                    provider: p.provider,
                    address: p.address,
                    height,
                    latency: Date.now() - start,
                    isSyncing,
                    chainId
                };
            })
        );

        const fulfilled = results
            .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(v => {
                const normalized = String(v.chainId || '').toLowerCase();
                const chainOk = normalized === CHAIN_ID || normalized.startsWith(`${CHAIN_ID}-`);
                return chainOk && v.height > 0 && !v.isSyncing;
            });

        if (fulfilled.length === 0) {
            return;
        }

        const sorted = fulfilled.sort((a, b) => b.height - a.height || a.latency - b.latency);

        if (fulfilled.length >= 3 || (force && fulfilled.length > 0)) {
            const best = sorted[0];
            this.currentRest = best.address;
            this.lastUpdate = Date.now();
        } else if (force) {
            const best = sorted[0];
            this.currentRest = best.address;
            this.lastUpdate = Date.now();
        }
    }
}
