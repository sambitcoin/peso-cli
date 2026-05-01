# peso-cli

**The agent-native command-line interface for Mexico's investment ecosystem.**

peso-cli is an open-source CLI built for AI agents (Claude, OpenClaw, and others) to interact with Mexican investment platforms through a single, stable, machine-readable interface. One command surface, one JSON contract, every major Mexican investment service.

> Roadmap: **Bitso** (crypto, FX) → **GBM** (equities, ETFs, fixed income) → broader Mexican fintech.

peso-cli is an independently developed, open-source project. It is **not affiliated with, endorsed by, or sponsored by** Bitso, GBM, or any other service it integrates with.

## Why peso-cli

Mexican investors increasingly hold assets across multiple platforms — crypto on Bitso, equities through GBM, cash in neobanks. Each has its own API, auth model, and data shape. For an AI agent trying to answer a simple question like *"what's my total portfolio worth in MXN?"*, that fragmentation is the whole problem.

peso-cli solves it the boring way: a unified CLI where every command returns the same JSON envelope, every error is machine-readable, and the same verbs mean the same thing across services. An agent that learns `peso bitso ticker btc` already knows how to call `peso gbm ticker NAFTRAC`.

- **Agent-first.** Stable JSON output, machine-readable error codes, exit codes that mean what they should.
- **Standardized verbs.** `ticker`, `positions`, `orders` mean the same thing on every service.
- **Service-namespaced.** `peso bitso positions`, `peso gbm positions` — the structure scales as services are added.
- **Public commands need zero setup.** An agent on a fresh machine can run `peso bitso ticker btc` with no auth.
- **Single binary, no runtime.** ~15 MB GraalVM native-image. No JRE, no Node, no Python.

## Standardized Command Vocabulary

Every service supported by peso-cli implements the same core verbs. The arguments differ — a crypto pair isn't an equity ticker — but the response shape and semantics are stable.

| Verb | Meaning | Auth | Example (Bitso) | Example (GBM, v0.2) |
|---|---|---|---|---|
| `ticker <symbol>` | Latest price for a tradable instrument | No | `peso bitso ticker btc` | `peso gbm ticker NAFTRAC` |
| `positions` | Holdings you currently own | Yes | `peso bitso positions` | `peso gbm positions` |
| `orders` | Open and recent orders | Yes | `peso bitso orders` | `peso gbm orders` |
| `order buy <symbol>` | Place a buy order | Yes | `peso bitso order buy btc_usdc ...` | `peso gbm order buy NAFTRAC ...` |
| `order sell <symbol>` | Place a sell order | Yes | `peso bitso order sell btc_usdc ...` | `peso gbm order sell NAFTRAC ...` |
| `auth set` | Configure credentials | — | `peso bitso auth set` | `peso gbm auth set` |
| `auth test` | Verify credentials | Yes | `peso bitso auth test` | `peso gbm auth test` |

Service-specific commands (e.g. `peso bitso orderbook`, `peso gbm dividends`) live alongside the standard verbs but are not guaranteed to exist on every service.

> **Note on `positions`:** On Bitso, positions are simply current asset balances (BTC, ETH, MXN). On GBM, positions are open equity/ETF/fixed-income holdings with cost basis. The response field names are aligned where possible (`symbol`, `quantity`, `available`, `value_mxn`) so agents can compute portfolio totals across services without service-specific code.

## Quick Start

```bash
# Install (macOS / Linux)
curl -sSL https://raw.githubusercontent.com/sambitcoin/peso-cli/main/install.sh | sh

# Public data — no credentials needed
peso bitso ticker btc
peso bitso ticker btc -o table
peso bitso orderbook btc_usdc --depth 5

# Configure credentials (one-time, per service)
peso bitso auth set --api-key YOUR_KEY --api-secret-stdin < secret.txt
peso gbm   auth set login

# Authenticated commands — same verbs, different services
peso bitso positions
peso bitso orders
peso bitso order buy btc_usdc --type limit --price 85000 --major 5000 --validate
peso bitso order buy btc_usdc --type limit --price 85000 --major 5000

peso gbm positions                                                        # v0.2
peso gbm orders                                                           # v0.2
peso gbm order buy NAFTRAC --type limit --price 245.50 --quantity 100     # v0.2
```

## Roadmap

peso-cli is being built in stages, prioritizing the platforms with the largest Mexican user bases first.

### v0.1 — Bitso (current)

Mexico's largest crypto exchange. Crypto and FX trading, balances, order management.

### v0.2 — GBM

Mexico's largest digital broker. Equities, ETFs, mutual funds, fixed income — quotes, positions, order placement, order history.

### v0.3+ — Broader Mexican fintech

Candidates under evaluation: Kuspit, Finamex, CetesDirecto, plus neobank read-only integrations (Albo, Klar) for unified portfolio views.

The selection rule is simple: integrate the platforms Mexican retail investors actually use, in the order of how many of them use it.

## Commands

Commands are namespaced by service: `peso <service> <command>`.

### Bitso — Public (no auth)

| Command | Description |
|---|---|
| `peso bitso ticker <coin>` | Get coin price in USD (`btc`, `eth`, `sol`). `--quote mxn` for MXN. |
| `peso bitso orderbook <book>` | View order book bids and asks. `--depth <n>` to limit. |

### Bitso — Authenticated

| Command | Description |
|---|---|
| `peso bitso positions` | Show all asset balances (BTC, ETH, MXN, USDC, etc.). |
| `peso bitso orders` | List open orders. `--book <book>` to filter. `--include-closed` for history. |
| `peso bitso order buy <book>` | Place a buy order (`--type market\|limit`). |
| `peso bitso order sell <book>` | Place a sell order (`--type market\|limit`). |
| `peso bitso auth set` | Write API credentials to `~/.config/peso/bitso.toml`. |
| `peso bitso auth test` | Verify credentials work against Bitso. |

### GBM — v0.2 (planned)

| Command | Description |
|---|---|
| `peso gbm ticker <symbol>` | Get equity/ETF/fund quote (`NAFTRAC`, `WALMEX`, `AMXL`). |
| `peso gbm positions` | List equity, ETF, and fixed-income holdings with cost basis. |
| `peso gbm orders` | List open orders. `--include-closed` for fill history. |
| `peso gbm order buy <symbol>` | Place a buy order (`--type market\|limit`, `--quantity <shares>`). |
| `peso gbm order sell <symbol>` | Place a sell order. |
| `peso gbm auth set` | Write API credentials to `~/.config/peso/gbm.toml`. |
| `peso gbm auth test` | Verify credentials work against GBM. |

GBM-specific extensions under design: `peso gbm dividends`, `peso gbm cash` (settled vs. unsettled cash), `peso gbm fund list` (mutual fund catalog).

## Output

**Default: JSON** — for agents and scripts. Every response uses the same envelope, regardless of which service it came from:

```json
{ "schema_version": "1.0", "service": "bitso", "result": { ... } }
{ "schema_version": "1.0", "service": "gbm",   "result": { ... } }
{ "schema_version": "1.0", "service": "bitso", "error": { "category": "...", "code": "...", "message": "...", "suggestion": "...", "retryable": true|false } }
```

**`-o table`** — human-readable tables. Diagnostics go to stderr. Parse stdout for data.

### Standardized Result Shapes

The standard verbs return shapes that align across services where it makes sense:

**`ticker`** — Bitso and GBM:
```json
{
  "schema_version": "1.0",
  "service": "bitso",
  "result": { "symbol": "btc_usdc", "last": "87152.34", "bid": "87140.00", "ask": "87165.00", "quote_currency": "usdc", "ts": "2026-05-01T18:23:11Z" }
}
```
```json
{
  "schema_version": "1.0",
  "service": "gbm",
  "result": { "symbol": "NAFTRAC", "last": "245.50", "bid": "245.40", "ask": "245.55", "quote_currency": "mxn", "ts": "2026-05-01T18:23:11Z" }
}
```

**`positions`** — Bitso and GBM:
```json
{
  "schema_version": "1.0",
  "service": "bitso",
  "result": { "positions": [
    { "symbol": "btc",  "quantity": "0.5234", "available": "0.5234", "value_mxn": "765234.10" },
    { "symbol": "mxn",  "quantity": "150000", "available": "150000", "value_mxn": "150000.00" }
  ], "total_mxn": "915234.10" }
}
```
```json
{
  "schema_version": "1.0",
  "service": "gbm",
  "result": { "positions": [
    { "symbol": "NAFTRAC", "quantity": "500", "available": "500", "value_mxn": "122750.00", "cost_basis_mxn": "118000.00", "asset_class": "etf" },
    { "symbol": "WALMEX",  "quantity": "200", "available": "200", "value_mxn": "13420.00",  "cost_basis_mxn": "12800.00",  "asset_class": "equity" }
  ], "total_mxn": "136170.00" }
}
```

An agent that knows how to sum `result.total_mxn` across services has a unified portfolio view in three lines of code.

## Safety Flags

| Flag | Behavior |
|---|---|
| `--validate` | Client-side parameter validation only. Does NOT call the upstream API. |
| `--api-secret-stdin` | Read API secret from stdin — never appears in `ps`. Preferred over env vars. |
| `--api-secret-file` | Read API secret from a file. |

## Credential Precedence

Credentials are scoped per service. For Bitso:

1. CLI flags: `--api-key` + `--api-secret-stdin` / `--api-secret-file`
2. Environment: `BITSO_API_KEY` + `BITSO_API_SECRET`
3. Config file: `~/.config/peso/bitso.toml` (0600 perms)

GBM and future services follow the same pattern: `GBM_API_KEY`, `~/.config/peso/gbm.toml`, etc. Each service's credentials are isolated — compromising one never exposes another.

## For AI Agents

peso-cli is designed from the ground up for LLM tool-use:

- **Stable JSON contract across services.** Every response is `{ "schema_version": "1.0", "service": "...", ... }`. Field names are stable. Error codes are machine-readable (`unknown_symbol`, `insufficient_balance`, `rate_limited`).
- **Same verbs across services.** Once an agent learns `peso <service> ticker`, `positions`, and `orders`, it can read any supported platform.
- **Public commands need zero setup.** An agent can run `peso bitso ticker btc` on a fresh clone with no API keys.
- **Service is always explicit.** `peso bitso positions` and `peso gbm positions` are different commands with different auth scopes. No ambiguity about which account an agent is touching.
- **Exit codes:** 0 = success, non-zero = failure. stderr is diagnostics only.
- **Rate limiting:** The CLI does not throttle. It surfaces rate-limit errors with `retryable: true` and the documented limit in the `suggestion` field. Let the agent decide backoff.
- **No client-side balance checks.** `--validate` only checks parameter sanity. The agent should call `positions` before placing large orders.

### Agent Workflow Examples

#### Example 1: Bitso-only — place a limit order

```bash
# 1. Check BTC price (no auth needed)
$ peso bitso ticker btc | jq '.result.last'
"87152.34"

# 2. Check MXN balance on Bitso
$ peso bitso positions | jq '.result.positions[] | select(.symbol=="mxn") | .available'
"150000.00"

# 3. List open orders
$ peso bitso orders | jq '.result.orders | length'
0

# 4. Validate before placing
$ peso bitso order buy btc_usdc --type limit --price 85000 --major 5000 --validate
{"schema_version":"1.0","service":"bitso","result":{"status":"valid","would_send":{...}}}

# 5. Place the order
$ peso bitso order buy btc_usdc --type limit --price 85000 --major 5000
{"schema_version":"1.0","service":"bitso","result":{"oid":"abc123","book":"btc_usdc","side":"buy","type":"limit","status":"queued",...}}
```

#### Example 2: GBM-only — buy NAFTRAC (v0.2)

```bash
# 1. Quote NAFTRAC (Mexico's main equity ETF)
$ peso gbm ticker NAFTRAC | jq '.result.last'
"245.50"

# 2. Check MXN cash available on GBM
$ peso gbm positions | jq '.result.positions[] | select(.symbol=="mxn") | .available'
"50000.00"

# 3. List open orders
$ peso gbm orders | jq '.result.orders | length'
0

# 4. Validate a 100-share NAFTRAC buy
$ peso gbm order buy NAFTRAC --type limit --price 245.00 --quantity 100 --validate
{"schema_version":"1.0","service":"gbm","result":{"status":"valid","would_send":{"symbol":"NAFTRAC","quantity":100,"price":"245.00","est_total_mxn":"24500.00"}}}

# 5. Place the order
$ peso gbm order buy NAFTRAC --type limit --price 245.00 --quantity 100
{"schema_version":"1.0","service":"gbm","result":{"oid":"gbm-7891","symbol":"NAFTRAC","side":"buy","type":"limit","quantity":100,"price":"245.00","status":"queued",...}}
```

#### Example 3: Cross-service — total portfolio in MXN (v0.2)

The standardized `positions` shape makes this trivial for an agent:

```bash
# Sum holdings across all configured services
$ peso bitso positions | jq '.result.total_mxn'
"915234.10"

$ peso gbm positions | jq '.result.total_mxn'
"136170.00"

# Agent computes: 915,234.10 + 136,170.00 = 1,051,404.10 MXN total
```

A more complete agent script:

```bash
#!/usr/bin/env bash
bitso_total=$(peso bitso positions | jq -r '.result.total_mxn')
gbm_total=$(peso gbm   positions | jq -r '.result.total_mxn')
echo "Crypto (Bitso):  $bitso_total MXN"
echo "Brokerage (GBM): $gbm_total MXN"
echo "Total:           $(echo "$bitso_total + $gbm_total" | bc) MXN"
```

#### Example 4: Cross-service — rebalance from crypto into NAFTRAC (v0.2)

A natural agent workflow once both services are live:

```bash
# 1. Sell 0.1 BTC on Bitso for MXN
$ peso bitso order sell btc_mxn --type market --major 0.1
{"...","status":"queued",...}

# 2. (User manually withdraws MXN from Bitso to bank, then deposits to GBM —
#     fiat rails are out of scope for v0.2; tracked for v0.3.)

# 3. Once funds settle on GBM, buy NAFTRAC
$ peso gbm order buy NAFTRAC --type market --quantity 50
{"...","status":"queued",...}
```

> Direct fiat movement between services is not in scope for the MVP. peso-cli reads and trades on each service independently; cash transfers between services remain a manual step (for now — see roadmap v0.3+).

#### Example 5: Cross-service — find your largest positions regardless of service (v0.2)

```bash
# Combine positions from both services into one ranked list
$ ( peso bitso positions; peso gbm positions ) \
  | jq -s '[.[] | .result.positions[]] | sort_by(.value_mxn | tonumber) | reverse | .[0:5]'
[
  { "symbol": "btc",     "quantity": "0.5234", "value_mxn": "765234.10", ... },
  { "symbol": "NAFTRAC", "quantity": "500",    "value_mxn": "122750.00", ... },
  { "symbol": "mxn",     "quantity": "150000", "value_mxn": "150000.00", ... },
  ...
]
```

Because both services use the same field names (`symbol`, `quantity`, `value_mxn`), the agent doesn't need service-specific parsing.

#### Example 6: Cross-service — list all open orders everywhere (v0.2)

```bash
$ ( peso bitso orders; peso gbm orders ) \
  | jq -s '[.[] | { service: .service, orders: .result.orders }] | .[] | "\(.service): \(.orders | length) open"'
"bitso: 2 open"
"gbm: 1 open"
```

## Build from Source

```bash
# Prerequisites: GraalVM JDK 21, Gradle 8.x
git clone https://github.com/sambitcoin/peso-cli.git
cd peso-cli
./gradlew nativeCompile
# Binary at: build/native/nativeCompile/peso
```

## Distribution

- **Prebuilt binaries:** macOS (arm64, x64), Linux (x64, arm64), Windows (x64) on [GitHub Releases](https://github.com/sambitcoin/peso-cli/releases).
- **One-line install:** `curl -sSL https://raw.githubusercontent.com/sambitcoin/peso-cli/main/install.sh | sh`
- **Homebrew:** `brew install sambitcoin/peso/peso-cli` (coming soon)

Binaries are self-contained GraalVM native-images — no JRE required. ~15 MB compressed.

## API Coverage

### v0.1 — Bitso

| Bitso Endpoint | Command | Auth |
|---|---|---|
| `GET /api/v3/ticker` | `peso bitso ticker` | No |
| `GET /api/v3/order_book` | `peso bitso orderbook` | No |
| `GET /api/v3/balance` | `peso bitso positions` | Yes |
| `POST /api/v3/orders` | `peso bitso order buy/sell` | Yes |
| `GET /api/v3/open_orders` | `peso bitso orders` | Yes |

### v0.2 — GBM (planned)

GBM endpoint coverage will be documented as the integration is built. Initial scope: quotes, positions (equities + ETFs + fixed income), order placement, order history.

## Error Envelope

Every error follows the same shape, regardless of service:

```json
{
  "schema_version": "1.0",
  "service": "bitso",
  "error": {
    "category": "validation",
    "code": "unknown_symbol",
    "message": "Unknown symbol: xrp.",
    "suggestion": "Supported symbols: btc, eth, sol.",
    "retryable": false,
    "docs_url": "",
    "details": null
  }
}
```

**Error categories:** `auth` | `rate_limit` | `validation` | `api` | `network`

Public commands never return `auth` errors. If a public command returns `auth`, that's a bug.

## Important Limitations (MVP v0.1)

- **No `cancel-after` / dead-man's switch.** Orders placed through the CLI must be manually cancelled. Known gap — plan accordingly.
- **No confirmation prompts in JSON mode.** `peso bitso order buy` submits immediately when `-o json` (the default). Use `--validate` first.
- **No max-order-size guard.** The CLI won't warn you about spending 100% of your balance.
- **`--validate` is client-side only.** Bitso REST v3 has no server-side dry-run endpoint. `--validate` checks parameter sanity but does not check balance sufficiency or simulate fills.
- **No cross-service fiat rails.** peso-cli reads and trades each service independently. Moving cash between Bitso and GBM remains a manual step.
- **Windows permissions.** Config file permissions are not restricted on Windows in MVP. Keep your API keys safe.

## Contributing

peso-cli's value compounds with every service added. If you use a Mexican investment platform that's not on the roadmap and want to contribute an integration, open an issue describing the platform's API surface and we'll discuss prioritization.

The bar for inclusion: the platform must have a documented API, be used by Mexican retail investors at meaningful scale, and have an auth model that doesn't require scraping.

New service integrations must implement the standard verbs (`ticker`, `positions`, `orders`, `order buy/sell`, `auth set/test`) with the standard response shapes, even if the underlying API uses different vocabulary. Service-specific commands are welcome on top, but the standard surface is non-negotiable — it's what makes peso-cli useful to agents.

## Disclaimer

peso-cli is an independently developed, open-source tool. It is **not affiliated with, endorsed by, or sponsored by** Bitso, GBM, or any other service it integrates with. All trademarks are the property of their respective owners.

This tool provides a command-line interface to the public APIs of supported services. You are responsible for:
- **Safeguarding your API keys.** Never share them. Never commit credentials to git.
- **Complying with each service's API Terms of Service.** Using peso-cli does not exempt you from the terms you agreed to with Bitso, GBM, or any other platform.
- **Understanding the risks of trading and investing.** This tool does not offer financial advice.
- **Complying with applicable laws and regulations** in your jurisdiction.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## License

MIT — see [LICENSE](LICENSE).
