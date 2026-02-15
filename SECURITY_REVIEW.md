# Security Review (Internal)

## Scope
- Inpage ↔ Content Script ↔ Background message flow
- Permission gating & approvals
- Wallet vault storage & session handling
- Transaction signing (Amino / Direct)

## Findings Checklist
- [ ] No seed/private key leakage in logs
- [ ] Origin validation for provider requests
- [ ] Approval requires explicit user gesture
- [ ] Pending queue recovery on service worker restart
- [ ] ChainId strict checking (Lumen only)
- [ ] RPC/REST endpoints health check & fallback

## Reviewer Notes
Add notes and date here after internal review.
