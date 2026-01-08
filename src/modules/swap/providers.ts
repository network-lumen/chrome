export interface SwapProvider {
    id: string;
    name: string;
    description: string;
    icon: string;
}

export const ALLOWLIST_PROVIDERS: SwapProvider[] = [
    {
        id: 'lumen-internal-swap',
        name: 'Lumen Swap',
        description: 'Official Lumen Bridge',
        icon: '/icons/logo.png' // Utilizing existing logo
    },
    {
        id: 'mock-provider',
        name: 'Mock Provider',
        description: 'Test Provider',
        icon: '/icons/logo.png'
    }
];

export const isProviderAllowed = (id: string): boolean => {
    return ALLOWLIST_PROVIDERS.some(p => p.id === id);
};
