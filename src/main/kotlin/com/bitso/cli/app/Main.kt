package com.bitso.cli.app

import com.bitso.cli.auth.AuthCommand
import com.bitso.cli.auth.BalanceCommand
import com.bitso.cli.auth.OrderCommand
import com.bitso.cli.public.OrderBookCommand
import com.bitso.cli.public.TickerCommand
import picocli.CommandLine
import picocli.CommandLine.Command

@Command(
    name = "bitso",
    description = [
        "",
        "AI-native trading CLI for Bitso — LATAM's largest crypto exchange.",
        "",
        "Commands:",
        "  Public (no auth required):",
        "    bitso ticker <coin>       Get coin price in USD (btc, eth, sol)",
        "    bitso orderbook <book>    View order book bids and asks",
        "",
        "  Authenticated (API keys required):",
        "    bitso balance              Show account balances",
        "    bitso order buy <book>    Place a buy order",
        "    bitso order sell <book>    Place a sell order",
        "    bitso order list           List open orders",
        "    bitso auth set             Configure API credentials",
        "    bitso auth test            Verify credentials work",
        "",
        "Output:",
        "  Default output is JSON (for agents). Use -o table for humans.",
        "  stderr is diagnostics only. Parse stdout for data.",
        "",
        "Credentials:",
        "  Precedence: --api-key/--api-secret-stdin > BITSO_API_KEY/BITSO_API_SECRET env",
        "  vars > ~/.config/bitso/config.toml.",
        "  Use --api-secret-stdin to keep secrets out of process listings.",
        "",
        "Documentation: https://github.com/sambitcoin/bitso-cli"
    ],
    subcommands = [
        TickerCommand::class,
        OrderBookCommand::class,
        BalanceCommand::class,
        OrderCommand::class,
        AuthCommand::class
    ],
    mixinStandardHelpOptions = true,
    version = ["bitso-cli v0.1.0"]
)
class BitsoCli : Runnable {
    override fun run() {
        // When no subcommand is given, print usage
        CommandLine.usage(this, System.out)
    }
}

fun main(args: Array<String>) {
    val exitCode = CommandLine(BitsoCli()).execute(*args)
    System.exit(exitCode)
}