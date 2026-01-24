/**
 * @file history.ts
 * @module HistoryManager
 * @description Manages local transaction history, including storage, retrieval, and advanced synchronization logic.
 * 
 * Features:
 * 1. Hybrid Scanner: Combines RPC 'block_results' (Events) and REST 'blocks' (Raw) for robust detection.
 * 2. Gap Sync: Uses RPC 'tx_search' to instantly backfill history after long offline periods.
 * 3. Force Trigger: Detects balance increases to force-recheck recent blocks.
 * 4. System Event Support: Captures protocol-level transfers (e.g., Block Rewards) that lack standard Tx Hashes.
 */

const STORAGE_KEY_HISTORY = 'lumen_history_v1';
const HISTORY_LIMIT = 100;

const RPC_BASE = "https://rpc-lumen.winnode.xyz";
const API_BASE = "https://api-lumen.winnode.xyz";

export interface Transaction {
    hash: string;
    height: string;
    timestamp: string;
    type: 'send' | 'receive' | 'stake' | 'unstake' | 'claim';
    amount: string;
    denom: string;
    counterparty: string;
    status: 'success' | 'failed';
}

interface HistoryStorage {
    [address: string]: Transaction[];
}

export class HistoryManager {

    // ==========================================
    // Core Storage Methods
    // ==========================================

    /**
     * Retrieves the sorted transaction history for a specific address.
     * @param address Wallet address
     */
    static getHistory(address: string): Transaction[] {
        const store = this.loadStore();
        return store[address] || [];
    }

    /**
     * Saves a single transaction to storage.
     * Handles deduplication and limits the history size.
     */
    static saveTransaction(address: string, tx: Transaction) {
        const store = this.loadStore();
        const history = store[address] || [];

        // Deduplication: Check if hash already exists
        if (history.some(t => t.hash === tx.hash)) return;

        // Add new transaction to the top
        history.unshift(tx);

        // Sort by timestamp DESC (Newest first) to ensure order
        history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Enforce History Limit
        if (history.length > HISTORY_LIMIT) {
            history.length = HISTORY_LIMIT;
        }

        store[address] = history;
        this.saveStore(store);
    }

    /**
     * Batch saves multiple transactions.
     * Useful for GapSync or migrations.
     */
    static saveHistory(address: string, newHistory: Transaction[]) {
        const store = this.loadStore();
        const current = store[address] || [];
        const merged = [...current];

        newHistory.forEach(tx => {
            if (!merged.some(existing => existing.hash === tx.hash)) {
                merged.push(tx);
            }
        });

        merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (merged.length > HISTORY_LIMIT) {
            merged.length = HISTORY_LIMIT;
        }

        store[address] = merged;
        this.saveStore(store);
    }

    // ==========================================
    // Synchronization Logic (The "Brain")
    // ==========================================

    /**
     * Gap Sync: The "Fast Forward" Mechanism.
     * 
     * Problem: If a user is offline for months, sequential scanning is too slow (millions of blocks).
     * Solution: We assume 'tx_index' is on. We query RPC `tx_search` for the latest 50 receipts.
     *           This instantly "jumps" the history to the present.
     * 
     * @param address Address to sync
     */
    static async syncGap(address: string) {
        try {
            console.log(`[GapSync] Starting fast sync for ${address}...`);

            // Query: transfer.recipient = 'address'
            // We request per_page=50, page=1, order=desc (newest first)
            const query = `transfer.recipient='${address}'`;
            const url = `${RPC_BASE}/tx_search?query="${query}"&prove=true&per_page=50&page=1&order_by="desc"`;

            const pRes = await fetch(url);
            if (!pRes.ok) return;
            const pData = await pRes.json();

            const txs = pData.result?.txs || [];
            if (txs.length === 0) {
                console.log("[GapSync] No recent history found via RPC search.");
                return;
            }

            console.log(`[GapSync] Found ${txs.length} transactions via RPC Search.`);

            // Dynamic Import for Crypto Libs (Optimization)
            const { fromBase64, toHex } = await import('@cosmjs/encoding');
            const { sha256 } = await import('@cosmjs/crypto');

            // Parallel Processing: Fetch block times for accurate timestamps
            await Promise.all(txs.map(async (tx: any) => {
                try {
                    const height = tx.height;
                    const txRes = tx.tx_result;
                    const rawTx = tx.tx; // Base64 of the tx itself

                    // 1. Calculate Real Tx Hash
                    // RPC returns 'hash' in root usually, but we fallback to calc if needed.
                    let hash = tx.hash;
                    if (!hash && rawTx) {
                        const hashBytes = sha256(fromBase64(rawTx));
                        hash = toHex(hashBytes).toUpperCase();
                    }

                    // 2. Fetch Timestamp (Lazy Block Fetch)
                    let timestamp = new Date().toISOString();
                    try {
                        const bRes = await fetch(`${RPC_BASE}/block?height=${height}`);
                        const bJson = await bRes.json();
                        if (bJson.result?.block?.header?.time) {
                            timestamp = bJson.result.block.header.time;
                        }
                    } catch { }

                    // 3. Parse Transfer Events
                    const events = txRes.events || [];
                    const transfer = events.find((e: any) => e.type === 'transfer');

                    let amt = "0";
                    let sender = "Unknown";

                    if (transfer) {
                        const findAttr = (key: string) => {
                            const a = transfer.attributes.find((attr: any) => attr.key === key || attr.key === btoa(key));
                            if (!a) return null;
                            let val = a.value;
                            // Base64 Heuristic Decoder
                            if (key === 'amount' && !val.includes('ulmn')) { try { val = atob(val); } catch { } }
                            if (key === 'sender' && !val.startsWith('lmn')) { try { val = atob(val); } catch { } }
                            return val;
                        };

                        const rawAmt = findAttr('amount');
                        if (rawAmt && rawAmt.includes('ulmn')) {
                            amt = (parseInt(rawAmt.replace('ulmn', '')) / 1_000_000).toFixed(6);
                        }

                        const rawSender = findAttr('sender');
                        if (rawSender) sender = rawSender;
                    }

                    this.saveTransaction(address, {
                        hash: hash,
                        height: height,
                        timestamp: timestamp,
                        type: 'receive',
                        amount: amt,
                        denom: 'LMN',
                        counterparty: sender,
                        status: 'success'
                    });

                } catch (e) { console.error("GapSync Parse Error", e); }
            }));

            // Update Watermark to the latest found tx height
            // This prevents the scanner from re-scanning these blocks needlessly.
            const maxH = Math.max(...txs.map((t: any) => parseInt(t.height)));
            const currentH = this.getLastScannedHeight(address);
            if (maxH > currentH) {
                this.saveLastScannedHeight(address, maxH);
            }

        } catch (e) {
            console.error("[GapSync] Failed", e);
        }
    }

    /**
     * Triggered by WalletTab when a balance increase is detected.
     * Forces a Deep Rescan (last 100 blocks) to capture the credit immediately.
     */
    static async onBalanceIncrease(address: string) {
        console.log(`[HistoryManager] Balance increased! Forcing deep rescan...`);
        await this.syncBlocks(address, 100, true); // Force=true ignores watermark
    }

    /**
     * The Continuous "Heartbeat" Scanner.
     * Runs every ~6s. Scans from [LastHeight] to [LatestHeight].
     * 
     * Strategy:
     * A. RPC Block Results (Preferred): Captures both User Txs and System Events.
     * B. REST Raw Blocks (Fallback): Captures parsed User Txs if RPC fails.
     * 
     * @param depth How many blocks to look back (default 20 for quick sync)
     * @param force If true, ignores 'lastScannedHeight' and forces checking old blocks
     */
    static async syncBlocks(address: string, depth = 20, force = false) {
        try {
            // 1. Get Chain Head (Try API first as it's CORS friendly)
            let latestHeight = 0;
            try {
                const latestRes = await fetch(`${API_BASE}/cosmos/base/tendermint/v1beta1/blocks/latest`);
                if (latestRes.ok) {
                    const latestData = await latestRes.json();
                    latestHeight = parseInt(latestData.block.header.height);
                }
            } catch (e) { console.warn("API Height fetch failed", e); }

            if (latestHeight === 0) {
                // Fallback to RPC for Height
                try {
                    const statusRes = await fetch(`${RPC_BASE}/status`);
                    if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        latestHeight = parseInt(statusData.result.sync_info.latest_block_height);
                    }
                } catch (e) {
                    return; // Offline
                }
            }

            // 2. Determine Scan Range
            let startHeight = this.getLastScannedHeight(address);

            // Reset logic: If we are too far behind (>1000 blocks), skip to recent.
            // GapSync handles the deep history.
            if (force || startHeight === 0 || (latestHeight - startHeight) > 1000) {
                startHeight = latestHeight - depth;
            }

            if (!force && startHeight >= latestHeight) return;

            const endHeight = Math.min(startHeight + depth, latestHeight);
            console.log(`[HybridScanner] Syncing ${startHeight + 1} to ${endHeight} (Force: ${force}, Head: ${latestHeight})`);

            // 3. Scan Loop
            const heights = [];
            for (let h = startHeight + 1; h <= endHeight; h++) heights.push(h);

            // Dynamic Imports
            const { fromBase64, toHex } = await import('@cosmjs/encoding');
            const { sha256 } = await import('@cosmjs/crypto');
            const { decodeTxRaw } = await import('@cosmjs/proto-signing');
            const { MsgSend } = await import('cosmjs-types/cosmos/bank/v1beta1/tx');

            await Promise.all(heights.map(async (height) => {
                let successRPC = false;

                // STRATEGY A: RPC Block Results (Events)
                try {
                    const resRes = await fetch(`${RPC_BASE}/block_results?height=${height}`);
                    if (resRes.ok) {
                        const resData = await resRes.json();
                        if (resData.result) {
                            successRPC = true;

                            // Fetch full block for Timestamp & Tx Bytes
                            const blockRes = await fetch(`${RPC_BASE}/block?height=${height}`);
                            const blockJson = await blockRes.json();
                            const blockTime = blockJson.result?.block?.header?.time || new Date().toISOString();
                            const blockTxs = blockJson.result?.block?.data?.txs || [];

                            const checkEvents = (events: any[], source: string, txBytes?: string, index?: number) => {
                                const transfer = events.find((e: any) => e.type === 'transfer');
                                if (transfer) {
                                    // Check recipient
                                    const recipientAttr = transfer.attributes.find((a: any) => a.key === 'recipient' || a.key === 'cmVjaXBpZW50');
                                    let rcpt = recipientAttr?.value;
                                    if (rcpt && !rcpt.startsWith('lmn')) { try { rcpt = atob(rcpt); } catch { } }

                                    if (rcpt === address) {
                                        this.saveFoundTx(address, height.toString(), blockTime, source, events, txBytes, index);
                                    }
                                }
                            };

                            // System Events (BeginBlock/EndBlock) - pass undefined bytes
                            checkEvents(resData.result.finalize_block_events || [], 'sys');

                            // User Transactions - pass matched bytes for Hash Calc
                            (resData.result.txs_results || []).forEach((txRes: any, i: number) => {
                                checkEvents(txRes.events || [], 'tx', blockTxs[i], i);
                            });
                        }
                    }
                } catch (e) { /* RPC failed */ }

                // STRATEGY B: REST Raw Block (Fallback)
                if (!successRPC) {
                    try {
                        console.log(`[HybridScanner] Falling back to Raw REST for block ${height}`);
                        const blockRes = await fetch(`${API_BASE}/cosmos/base/tendermint/v1beta1/blocks/${height}`);
                        if (blockRes.ok) {
                            const blockJson = await blockRes.json();
                            const blk = blockJson.block || blockJson.sdk_block;
                            if (blk && blk.data && blk.data.txs) {
                                blk.data.txs.forEach((txBase64: string) => {
                                    try {
                                        const txRaw = decodeTxRaw(fromBase64(txBase64));
                                        txRaw.body.messages.forEach((msg) => {
                                            if (msg.typeUrl === '/cosmos.bank.v1beta1.MsgSend') {
                                                const decoded = MsgSend.decode(msg.value);
                                                const amount = decoded.amount[0];
                                                const amt = amount ? (parseFloat(amount.amount) / 1000000).toFixed(6) : "0";
                                                const h = toHex(sha256(fromBase64(txBase64))).toUpperCase();

                                                // Check if receiving
                                                if (decoded.toAddress === address) {
                                                    this.saveTransaction(address, {
                                                        hash: h,
                                                        height: height.toString(),
                                                        timestamp: blk.header.time,
                                                        type: 'receive',
                                                        amount: amt,
                                                        denom: 'LMN',
                                                        counterparty: decoded.fromAddress,
                                                        status: 'success'
                                                    });
                                                }

                                                // Check if sending
                                                if (decoded.fromAddress === address) {
                                                    this.saveTransaction(address, {
                                                        hash: h,
                                                        height: height.toString(),
                                                        timestamp: blk.header.time,
                                                        type: 'send',
                                                        amount: amt,
                                                        denom: 'LMN',
                                                        counterparty: decoded.toAddress,
                                                        status: 'success'
                                                    });
                                                }
                                            } else if (msg.typeUrl === '/cosmos.staking.v1beta1.MsgDelegate') {
                                                const h = toHex(sha256(fromBase64(txBase64))).toUpperCase();
                                                this.saveTransaction(address, {
                                                    hash: h,
                                                    height: height.toString(),
                                                    timestamp: blk.header.time,
                                                    type: 'stake',
                                                    amount: 'Checking...',
                                                    denom: 'LMN',
                                                    counterparty: 'Lumen Staking',
                                                    status: 'success'
                                                });
                                            }
                                        });
                                    } catch { }
                                });
                            }
                        }
                    } catch (e) { /* REST failed */ }
                }
            }));

            // 4. Update Checkpoint
            if (!force) {
                this.saveLastScannedHeight(address, endHeight);
            }

        } catch (e) {
            console.error("[HybridScanner] Fatal error", e);
        }
    }

    // ==========================================
    // Internal Helpers
    // ==========================================

    private static getLastScannedHeight(address: string): number {
        const key = `lumen_last_height_${address}`;
        const val = localStorage.getItem(key);
        return val ? parseInt(val) : 0;
    }

    private static saveLastScannedHeight(address: string, height: number) {
        localStorage.setItem(`lumen_last_height_${address}`, height.toString());
    }

    private static loadStore(): HistoryStorage {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    private static saveStore(store: HistoryStorage) {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(store));
    }

    private static async saveFoundTx(address: string, height: string, time: string, source: string, events: any[], txBytes?: string, index?: number) {
        console.log(`[HybridScanner] Match found: ${source} at ${height}`);

        // 1. Compute Hash
        let hash = "";
        if (source === 'tx' && txBytes) {
            try {
                const { fromBase64, toHex } = await import('@cosmjs/encoding');
                const { sha256 } = await import('@cosmjs/crypto');
                const hashBytes = sha256(fromBase64(txBytes));
                hash = toHex(hashBytes).toUpperCase();
            } catch (e) { console.warn("Hash calc failed", e); }
        }

        // Fallback: Use Synthetic ID for System Events or missing bytes
        if (!hash) {
            hash = `detected-${height}-${index ?? source}-${Date.now().toString().slice(-4)}`;
        }

        // 2. Parse Amount & Sender
        let amt = "0";
        const transfer = events.find((e: any) => e.type === 'transfer');
        const amountAttr = transfer?.attributes?.find((a: any) => a.key === 'amount' || a.key === 'YW1vdW50');
        if (amountAttr) {
            let val = amountAttr.value;
            if (!val.includes('ulmn')) { try { val = atob(val); } catch { } }
            if (val.includes('ulmn')) {
                amt = (parseInt(val.replace('ulmn', '')) / 1_000_000).toFixed(6);
            }
        }

        const senderAttr = transfer?.attributes?.find((a: any) => a.key === 'sender' || a.key === 'c2VuZGVy');
        let sender = "Unknown";
        if (senderAttr) {
            let val = senderAttr.value;
            if (!val.startsWith('lmn')) { try { val = atob(val); } catch { } }
            sender = val;
        }

        // 3. Save
        this.saveTransaction(address, {
            hash: hash,
            height: height,
            timestamp: time,
            type: 'receive',
            amount: amt,
            denom: 'LMN',
            counterparty: sender,
            status: 'success'
        });
    }
}
