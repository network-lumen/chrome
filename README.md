# Lumen Wallet Extension

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Vite%20%7C%20WASM-blueviolet)

A non-custodial, hybrid post-quantum browser extension wallet built for the **Lumen Network**. 
This wallet implements the **Dual-Signer Architecture**, combining standard ECDSA (secp256k1) with NIST-standard Dilithium3 signatures to ensure long-term security against quantum threats.

---

## 🚀 Key Features

### 🛡️ Hybrid Post-Quantum Security
Unlike traditional Cosmos wallets, Lumen Wallet mandates a **PQC Signature (Dilithium3)** for every transaction. The extension manages the complexity of:
- **Dual-Key Generation:** Creates linked identities for consensus and PQC layers.
- **WASM-Based Signing:** High-performance cryptographic operations directly in the browser.
- **Critical Extension Options:** Manages protocol-level transaction extensions required by the Lumen chain.

### 🔌 Universal Key Adapter
Designed for interoperability with Validator nodes and CLI tools.
- **Smart Import:** Automatically detects and normalizes `snake_case` (Validator standard) vs `camelCase` (JS standard) JSON keys.
- **Format Agnostic:** Seamlessly handles **Hex** and **Base64** encoded keys, preventing common format mismatch errors during import.

### ⚡ Direct Node Indexing
Eliminates reliance on centralized third-party indexers.
- Fetches transaction history (Incoming/Outgoing) directly from the **Lumen Node LCD (REST API)**.
- Real-time status updates and balance tracking.

### 🌐 Cross-Browser Compatibility
Built on a unified codebase that supports:
- **Google Chrome** (Manifest V3 service workers).
- **Mozilla Firefox** (Gecko background scripts).
- Includes robust polyfills for `Buffer` and `Browser` APIs.

---

## 🛠️ Build & Development

### Prerequisites
- Node.js v18+
- npm / yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/lumen-wallet-extension.git

# Install dependencies (includes WASM and Polyfills)
npm install

# Development Build (Watch Mode)
npm run dev

# Production Build
npm run build
```

### Loading in Browser
**Chrome**: Go to `chrome://extensions`, enable **Developer Mode**, click **Load Unpacked**, and select `dist/`.

**Firefox**: Go to `about:debugging`, click **This Firefox**, then **Load Temporary Add-on**, and select `dist/manifest.json`.

## 📦 Project Structure

```plaintext
src/
├── components/      # UI Components (Presentational)
├── hooks/           # React Hooks (Business Logic)
├── modules/
│   └── sdk/         # Core Logic (KeyManager, TxBuilder, WASM)
├── types/           # Strict TypeScript Interfaces
└── utils/           # Polyfills and Helpers
```

## 🤝 Contributing
Contributions are welcome. Please ensure all pull requests follow the **Strict Commenting Style** and pass the TypeScript compiler checks.

---

## Creator & Maintainer
rikijoniiskandar — https://github.com/rikijoniiskandar

© 2026 Lumen Network Contributors.
