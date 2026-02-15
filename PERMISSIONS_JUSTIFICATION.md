# Permissions Justification – Lumen Wallet

This document explains why each permission is required.

## Chrome Extension Permissions
- **storage**  
  Store encrypted wallet vault, user settings, connected dApps, and pending approvals locally.

- **sidePanel**  
  Show approval requests consistently without opening multiple popups.

- **contextMenus**  
  Provide quick access actions from the extension icon menu.

## Host Permissions (Optional)
The extension interacts with Lumen RPC/REST endpoints to query balances, chain state, and submit transactions.

### Why broad host permissions exist
The extension is intended to connect to many dApps across different domains.  
Some flows require access to specific RPC/REST endpoints and dApp domains.

> NOTE: For production, we recommend restricting or dynamically requesting host permissions only for approved domains.

## Content Script Injection
The provider is injected so dApps can request wallet actions (connect, sign, etc.).  
This is standard for blockchain wallets and is required for compatibility with dApps.

---

If any reviewer needs more details, contact: `support@YOUR_DOMAIN_HERE`.
