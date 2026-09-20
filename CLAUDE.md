# Lumen Wallet Extension — working notes

Chrome MV3 extension (React 19 + Vite + Tailwind 4) for the Lumen chain.
Non-custodial, dual-signature: every transaction carries a secp256k1 signature
*and* a Dilithium3 (PQC) one.

## Chain coupling

The wallet talks to a chain that moves. Two version numbers have to agree:

| | version |
|---|---|
| chain (`~/Desktop/lumen/blockchain`) | **v2.0.0** |
| `@lumen-chain/sdk` | **2.0.0** |

The SDK is published to npm; its source lives in
`~/Desktop/lumen/integrations/npm/sdk`. When the chain releases, diff
`integrations/npm/sdk/src/pqc/` against what the wallet calls — most SDK calls
sit behind `@ts-ignore`, so a changed signature compiles cleanly and fails at
runtime. That is exactly how the v2.0.0 proof-of-work change went unnoticed.

### Transactions are gasless, but messages are priced

`app/ante_zero_fee.go` refuses a fee on an ordinary transaction and *requires*
a positive one on an IBC transfer. So `Fee.amount` stays `[]` everywhere except
`buildAndSignIbcTransferTx`. Don't "fix" that.

Separately, since v2.0.0 `app/ante_message_fee.go` charges per message, taken
from the account balance before the message runs:

| message | param | ships at |
|---|---|---|
| `MsgSend`, `MsgTransfer` | `transfer_fee_ulmn` | 1000 ulmn |
| `MsgDelegate` | `delegate_fee_ulmn` | 1000 ulmn |
| `MsgBeginRedelegate` | `redelegate_fee_ulmn` | 1000 ulmn |
| `MsgSetWithdrawAddress` | `set_withdraw_addr_fee_ulmn` | 1000 ulmn |

`MsgWithdrawDelegatorReward`, `MsgUndelegate` and `MsgVote` are **not** priced.

Consequence for the UI: "MAX" is never the whole balance for a priced message —
the ante needs the fee on top, and offering the balance produces a transaction
the chain refuses. `src/modules/sdk/chain-params.ts` reads these live (they are
all votable) with the shipped values as fallback.

Two more numbers from the same params block:

- `min_send_ulmn` (1000): the chain refuses a smaller transfer.
- `min_voting_stake_ulmn` (1 LMN, DAO intends 5): an account below this cannot
  vote. Governance checks it before enabling the button.

The **transfer tax** (`tx_tax_rate`, 1%) is charged to the *recipient*
(`app/send_tax_calc.go`), not the sender. Sender pays `amount + fee`, recipient
nets `amount × 0.99`. The confirm screen shows both.

### Other v2.0.0 constraints

- **64 messages per transaction** (`app/ante_max_messages.go`). `claimAllRewards`
  chunks on this.
- **PoW link digest changed** to `sha256(creator || "|" || pubKey || nonce)`.
  `computePowNonce` now takes the bech32 address first. `pow_difficulty_bits`
  ships at **0** on purpose so nonces mined under the old formula stay valid —
  read it with `??`, never `||`, or a deliberate 0 becomes 21 and the wallet
  mines a proof of work nobody asked for.
- **Blocked messages** the wallet must never build:
  `MsgCancelUnbondingDelegation`, `MsgFundCommunityPool`,
  `MsgDepositValidatorRewardsPool`, `MsgSubmitEvidence`.
- **No shared custody**: `x/authz`, `x/group`, `x/feegrant` are not wired, and a
  multisig account can receive funds but never move them.

## Broadcasting

`broadcastTx` uses `BROADCAST_MODE_SYNC`, which returns when the transaction
passes CheckTx — *before* it is in a block. Refreshing on that return reads the
state the transaction was meant to change, which is why confirmations used to
look like they had done nothing.

Always follow a broadcast with `waitForTxCommit(hash)` before refreshing or
before signing the next transaction. It returns `null` on timeout, which means
"still pending", not "failed" — say so in the toast rather than claiming success.

Several transactions in a row share an account sequence, so they must be
committed one at a time; parallel broadcast gets the second rejected.

## Networking

Everything goes through `NetworkManager` (`src/modules/sdk/network.ts`). It
races the REST providers on height and latency and caches the winner for five
minutes.

Never hardcode an endpoint in a component or module — several did, and each one
kept polling `rest.cosmos.directory` whatever the user had selected in settings
and whatever the health check had found. That is most of what "the balance/
history doesn't refresh" turned out to be.

- `getRestEndpoint()` — async, may wait for the health race.
- `getQuickRestEndpoint()` — sync, returns the current choice and refreshes in
  the background. For polls and tight loops.

Any new host also needs an entry in `manifest.json` `host_permissions` **and**
in `src/permissions.ts`.

## Views

One `index.html` serves three contexts, told apart by a `?view=` marker that
`main.tsx` copies onto `document.documentElement.dataset.view` before first
paint:

| context | URL | size |
|---|---|---|
| popup | `index.html` | fixed 400×600 in CSS |
| side panel | `index.html?view=panel` | fills its container |
| expanded tab | `index.html?view=tab` | fills the tab |

The popup **must** declare its own size: Chrome sizes a popup to its content and
caps it at 800×600, so a page whose height resolves through percentages of an
unsized root collapses to whatever the content happens to measure — which is
what clipped buttons and pushed them under the footer.

CSP is `script-src 'self'`, so the marker cannot be applied by an inline script
in `index.html`; it has to be the first thing `main.tsx` does.

### There is a second stylesheet, and it wins

`assets/theme.css` is pulled in by a raw `<link>` in `index.html`, separately
from the Tailwind entry in `src/index.css`. Vite bundles it into the same
`main-*.css`, after the utilities, and almost every rule in it carries
`!important` — so it beats every Tailwind class on the element it targets, and
reading `src/index.css` alone tells you nothing about the layout you get.

It overrides bare element selectors (`footer`, `header`, `main`, `#root`,
`#root > div`, `body`), including `overflow: visible !important` on several
containers, which defeats the `overflow: hidden` set in `index.css`.

**When a layout does something the JSX and its Tailwind classes cannot explain,
look here first.** The footer was `position: fixed; left: 0; right: 0` in this
file: it escaped the `max-w-md` column to span the whole window, and reserved no
space, so `main` ran underneath and swallowed whatever sat at the bottom of a
screen. No flex sizing in React could compensate, because an out-of-flow element
gives the column nothing to size around.

`pb-24` belongs on a scrolling container (runway at the end of the list), never
on a `shrink-0` block — there it is dead space that squeezes the content above.

## Locking

The vault key is an AES-GCM `CryptoKey` kept in **IndexedDB**, not in
`chrome.storage.session`. That is deliberate — a non-extractable CryptoKey is
not JSON, so storage.session cannot hold it, while IndexedDB structured-clones
it and the raw bytes never become readable to script.

The consequence is that the key is **durable**: it survives the popup closing,
the service worker being evicted, and the browser restarting. Only
`clearSession()` removes it. `isLocked` in React is a render flag; it hides the
UI and revokes nothing.

Expiry is a timestamp (`lastActiveAt` in `chrome.storage.session`) compared
against the configured timeout. `isSessionExpired()` only *reports* — the one
function that enforces is `VaultManager.lockIfExpired()`, which is reached from:

1. **the background `auto-lock` alarm**, every minute — the only check that runs
   with every view closed. One minute is Chrome's floor for alarm periods, so
   the lock can overshoot the configured timeout by up to that.
2. **every service worker startup**, top-level, since the worker wakes for any
   dApp message, alarm or popup open.
3. **`chrome.runtime.onStartup`** — a browser restart clears storage.session and
   with it `lastActiveAt`, but not the IndexedDB key, so the key from the
   previous browser session has to be dropped explicitly.
4. **`checkSession()` in App.tsx**, before the first `getWallets()`.
5. the 5s poll in App.tsx, while a view is open.

**`getWallets()` consults no timeout.** It succeeds whenever the key is on disk,
so anything that reads the vault before `lockIfExpired()` — or without asking
`checkWalletLocked()` — has bypassed the lock. Treat "the call threw" as "no key
at all", never as "locked". Every new vault read needs its own gate.

Alarms are created through `ensureAlarm()`, which skips creation when the alarm
already exists. `chrome.alarms.create()` on an existing name clears and replaces
it, restarting its countdown — and background top-level code re-runs on every
worker wake, so unconditional creation pushes a one-minute alarm out of reach of
ever firing.

## Conventions

- Comments explain *why*, in full sentences. The repo calls this the "Strict
  Commenting Style" and the README asks PRs to follow it.
- `npm run build` runs `tsc -b` first; it must stay clean.
- `npx eslint src/` currently reports ~260 pre-existing errors, mostly
  `no-explicit-any`. Don't add to the pile; fixing the rest is its own task.
- Release zips (`chrome-extension.*.zip`) are gitignored — build artifacts, not
  versioned files.

## Known gaps

- **The PoW progress bar never moves**: `computeLinkPowNonce` passes an
  `onProgress` callback, but `PowOptions` has no such field in any SDK version.
  Harmless while `pow_difficulty_bits` is 0 and mining returns instantly.
- **`createKeyPair('dilithium3')`** passes an argument the 2.0.0 signature no
  longer takes. Ignored at runtime, but it will not survive a stricter build.
- **`max_entries`** bounds how many unbondings a delegator may have in flight;
  the wallet neither checks it nor explains the refusal.
- **Unbonding period is described as "21 days on Cosmos networks"** in the UI
  rather than read from the chain's `unbonding_time`.
