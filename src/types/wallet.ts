export interface PqcKeyData {
    name?: string;
    scheme: "dilithium3";
    publicKey: string;  // Hex String
    privateKey: string; // Hex String
    createdAt?: string;
}

export interface LumenWallet {
    [x: string]: any;
    type?: string;
    version?: number;
    address: string;
    mnemonic: string;
    pqcKey: PqcKeyData; // Standardized to pqcKey
    linked?: boolean;      // Is PQC key registered on-chain?
    linkedAt?: string;     // When was it linked (ISO timestamp)
    linkTxHash?: string;   // Transaction hash of link operation
}
