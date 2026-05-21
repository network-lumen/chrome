export const REQUIRED_HOST_PERMISSIONS = [
  'https://rpc.cosmos.directory/lumen/*',
  'https://rest.cosmos.directory/lumen/*',
  'https://rpc.lumen.chaintools.tech/*',
  'https://lumen.blocksync.me/*',
  'https://lumen-mainnet-rpc.mekonglabs.com/*',
  'https://rpc-lumen.onenov.xyz/*',
  'https://lumen-api.node9x.com/*',
  'https://api.lumen.chaintools.tech/*',
  'https://lumen-mainnet-api.mekonglabs.com/*'
];

export const originToPattern = (origin: string): string | null => {
  try {
    const url = new URL(origin);
    return `${url.origin}/*`;
  } catch {
    return null;
  }
};
