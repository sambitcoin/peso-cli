
# bitso-cli

AI-native trading CLI for Bitso (crypto, FX).

Open-source, agent-first command-line tool for investing and trading.
- Wraps Bitso’s direct API integrations (prices, balances, books, conversions, orders)  
- Built for AI agents (Claude, OpenClaw), you can use it simply with a simple prompt in OpenClaw or Claude "check my balance at Bitso"
- Designed as a skill-based system (target: 10+ core capabilities)  

bitso-cli is an independently developed, open-source tool. It is **not affiliated with, endorsed by, or sponsored by** Bitso

## Quick Start

```bash
# Install (macOS / Linux)
curl -sSL https://raw.githubusercontent.com/sambitcoin/bitso-cli/main/install.sh | sh

# No credentials needed for public data
bitso ticker btc
bitso ticker btc -o table
bitso orderbook btc_usdc --depth 5

# Configure trading credentials (one-time)
bitso auth set --api-key YOUR_KEY --api-secret-stdin < secret.txt

# Authenticated commands
bitso balance
bitso order list
bitso order buy btc_usdc --type limit --price 85000 --major 5000
bitso order buy btc_usdc --type limit --price 85000 --major 5000 --validate
```

## Commands

### Public (no auth — works on a fresh machine with zero config)

| Command | Description |
|---|---|
| `bitso ticker <coin>` | Get coin price in USD (`btc`, `eth`, `sol`). `--quote mxn` for MXN. |
| `bitso orderbook <book>` | View order book bids and asks. `--depth <n>` to limit. |

### Authenticated (requires `bitso auth set`)

| Command | Description |
|---|---|
| `bitso balance` | Show all asset balances. |
| `bitso order buy <book>` | Place a buy order (`--type market\|limit`). |
| `bitso order sell <book>` | Place a sell order (`--type market\|limit`). |
| `bitso order list` | List open orders. `--book <book>` to filter. |
| `bitso auth set` | Write API credentials to `~/.config/bitso/config.toml`. |
| `bitso auth test` | Verify credentials work against Bitso. |

### Output

- **Default: JSON** — for agents and scripts. Every response uses the same envelope:

```json
{ "schema_version": "1.0", "result": { ... } }
{ "schema_version": "1.0", "error": { "category": "...", "code": "...", "message": "...", "suggestion": "...", "retryable": true|false } }
```

- **`-o table`** — human-readable tables. Diagnostics go to stderr. Parse stdout for data.

### Safety Flags

| Flag | Behavior |
|---|---|
| `--validate` | Client-side parameter validation only. Does NOT call the API. |
| `--api-secret-stdin` | Read API secret from stdin — never appears in `ps`. Preferred over env vars. |
| `--api-secret-file` | Read API secret from a file. |

## Credential Precedence

1. CLI flags: `--api-key` + `--api-secret-stdin` / `--api-secret-file`
2. Environment: `BITSO_API_KEY` + `BITSO_API_SECRET`
3. Config file: `~/.config/bitso/config.toml` (0600 perms)

## For AI Agents

bitso-cli is designed for LLM tool-use:

- **Stable JSON contract.** Every response is `{ "schema_version": "1.0", ... }`. Field names are stable. Error codes are machine-readable (`unknown_coin`, `insufficient_balance`, `rate_limited`).
- **Public commands need zero setup.** An agent can run `bitso ticker btc` on a fresh clone with no API keys configured.
- **Exit codes:** 0 = success, non-zero = failure. stderr is diagnostics only.
- **Rate limiting:** The CLI does not throttle. It surfaces rate-limit errors with `retryable: true` and the `Suggestion` field includes the documented limit (60 RPM/IP public). Let the agent decide backoff.
- **No client-side balance checks.** `--validate` only checks parameter sanity. The agent should `bitso balance` before placing large orders.

### Agent Workflow Example

```bash
# 1. Check BTC price (no auth needed)
$ bitso ticker btc | jq '.result.last'
"87,152.34"

# 2. Check MXN balance (auth)
$ bitso balance | jq '.result.balances[] | select(.currency=="mxn") | .available'
"150,000.00"

# 3. List open orders (auth)
$ bitso order list | jq '.result.orders | length'
0

# 4. Validate before placing (no API call)
$ bitso order buy btc_usdc --type limit --price 85000 --major 5000 --validate
{"schema_version":"1.0","result":{"status":"valid","would_send":{...}}}

# 5. Place the order
$ bitso order buy btc_usdc --type limit --price 85000 --major 5000
{"schema_version":"1.0","result":{"oid":"abc123","book":"btc_usdc","side":"buy","type":"limit","status":"queued",...}}
```

## Build from Source

```bash
# Prerequisites: GraalVM JDK 21, Gradle 8.x
git clone https://github.com/sambitcoin/bitso-cli.git
cd bitso-cli
./gradlew nativeCompile
# Binary at: build/native/nativeCompile/bitso
```

## Distribution

- **Prebuilt binaries:** macOS (arm64, x64), Linux (x64, arm64), Windows (x64) on [GitHub Releases](https://github.com/sambitcoin/bitso-cli/releases).
- **One-line install:** `curl -sSL https://raw.githubusercontent.com/sambitcoin/bitso-cli/main/install.sh | sh`
- **Homebrew:** `brew install sambitcoin/bitso/bitso-cli` (coming soon)

Binaries are self-contained GraalVM native-images — no JRE required. ~15 MB compressed.

## API Coverage (v0.1)

| Bitso Endpoint | Command | Auth |
|---|---|---|
| `GET /api/v3/ticker` | `bitso ticker` | No |
| `GET /api/v3/order_book` | `bitso orderbook` | No |
| `GET /api/v3/balance` | `bitso balance` | Yes |
| `POST /api/v3/orders` | `bitso order buy/sell` | Yes |
| `GET /api/v3/open_orders` | `bitso order list` | Yes |

## Error Envelope

Every error follows this shape:

```json
{
  "schema_version": "1.0",
  "error": {
    "category": "validation",
    "code": "unknown_coin",
    "message": "Unknown coin: xrp.",
    "suggestion": "Supported coins: btc, eth, sol.",
    "retryable": false,
    "docs_url": "",
    "details": null
  }
}
```

**Error categories:** `auth` | `rate_limit` | `validation` | `api` | `network`

Public commands never return `auth` errors. If a public command returns `auth`, that's a bug.

## Important Limitations (MVP v0.1)

- **No `cancel-after` / dead-man's switch.** Orders placed through the CLI must be manually cancelled. This is a known gap — plan accordingly.
- **No confirmation prompts in JSON mode.** `bitso order buy` submits immediately when `-o json` (the default). Use `--validate` first.
- **No max-order-size guard.** The CLI won't warn you about spending 100% of your balance.
- **`--validate` is client-side only.** Bitso REST v3 has no server-side dry-run endpoint. `--validate` checks parameter sanity but does not check balance sufficiency or simulate fills.
- **Windows permissions.** `config.toml` permissions are not restricted on Windows in MVP. Keep your API keys safe.

## Disclaimer

bitso-cli is an independently developed, open-source tool. It is **not affiliated with, endorsed by, or sponsored by** Bitso

This tool provides a command-line interface to Bitso's public REST API v3. You are responsible for:
- **Safeguarding your API keys.** Never share them. Never commit `config.toml` to git.
- **Understanding the risks of trading cryptocurrency.** This tool does not offer financial advice.
- **Complying with applicable laws and regulations** in your jurisdiction.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## License

MIT — see [LICENSE](LICENSE).
