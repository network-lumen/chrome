import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { LumenWallet } from '../../modules/sdk/key-manager';

interface TradeProps {
    walletKeys: LumenWallet;
}

interface TradeListing {
    id: string;
    venue: string;
    title: string;
    subtitle: string;
    url: string;
}

const TRADE_LISTINGS: TradeListing[] = [
    {
        id: 'beezee-lmn-usdc',
        venue: 'BeeZee DEX',
        title: 'LMN / USDC',
        subtitle: 'Open the BeeZee market page for LMN against USDC.',
        url: 'https://dex.getbze.com/exchange/market?id=ibc/693DDB2D9B4260D67C8136C22D837F37488E0FBD81857D8E9C6022332EA26E33/ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4'
    }
];

function openExternalUrl(url: string): void {
    const chromeApi = globalThis.chrome;
    if (chromeApi?.tabs?.create) {
        chromeApi.tabs.create({ url });
        return;
    }

    globalThis.open(url, '_blank', 'noopener,noreferrer');
}

export const Trade: React.FC<TradeProps> = (_props) => {
    return (
        <div className="flex flex-col h-full min-h-0 animate-fade-in">
            <header className="flex items-center justify-between gap-4 p-4 border-b border-border">
                <div>
                    <h2 className="text-lg font-bold text-foreground">Trade</h2>
                    <p className="text-[11px] text-[var(--text-muted)]">Open supported markets in an external tab.</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 pb-24 space-y-4">
                {TRADE_LISTINGS.map((listing) => (
                    <div key={listing.id} className="rounded-2xl border border-border bg-surface p-4 space-y-4">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                                {listing.venue}
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-foreground tracking-tight">{listing.title}</h3>
                                <p className="text-[11px] text-[var(--text-muted)]">{listing.subtitle}</p>
                            </div>
                        </div>

                        <button
                            onClick={() => openExternalUrl(listing.url)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                        >
                            Open Market
                            <ExternalLink className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
