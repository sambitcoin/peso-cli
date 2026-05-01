package com.bitso.cli.output

import com.bitso.cli.model.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.serializer

/**
 * Shared JSON encoder configured for the bitso-cli output contract.
 */
object JsonOutput {
    val json = Json {
        prettyPrint = true
        encodeDefaults = true
        ignoreUnknownKeys = true
        isLenient = true
    }

    inline fun <reified T : Any> success(result: T): String {
        val envelope = SuccessEnvelope(result = result)
        return json.encodeToString(envelope)
    }

    fun error(err: BitsoError): String {
        val envelope = ErrorEnvelope(error = err)
        return json.encodeToString(envelope)
    }
}

/**
 * Renders results as human-readable tables for `-o table` mode.
 */
object TableOutput {

    fun ticker(r: TickerResult): String = buildString {
        appendLine("  ┌──────────────┬───────────┬──────────┐")
        appendLine("  │ %-12s │ %-9s │ %-8s │".format("Coin", r.coin.uppercase(), r.currency.uppercase()))
        appendLine("  ├──────────────┼───────────┼──────────┤")
        appendLine("  │ %-12s │ %-9s │          │".format("Book", r.book))
        appendLine("  │ %-12s │ %-9s │          │".format("Last", r.last))
        appendLine("  │ %-12s │ %-9s │          │".format("Bid", r.bid))
        appendLine("  │ %-12s │ %-9s │          │".format("Ask", r.ask))
        appendLine("  │ %-12s │ %-9s │          │".format("High", r.high))
        appendLine("  │ %-12s │ %-9s │          │".format("Low", r.low))
        appendLine("  │ %-12s │ %-9s │          │".format("Volume", r.volume))
        appendLine("  │ %-12s │ %-9s │          │".format("VWAP", r.vwap))
        if (r.fx != null) {
            appendLine("  ├──────────────┴───────────┴──────────┤")
            appendLine("  │ FX Conversion                        │")
            appendLine("  ├──────────────┬───────────────────────┤")
            appendLine("  │ %-12s │ %-21s │".format("Rate", r.fx.rate))
            appendLine("  │ %-12s │ %-21s │".format("Source", r.fx.source))
        }
        appendLine("  └──────────────┴───────────┴──────────┘")
    }

    fun orderBook(r: OrderBookResult, depth: Int = Int.MAX_VALUE): String = buildString {
        val d = minOf(depth, r.bids.size, r.asks.size)
        appendLine("  Book: ${r.book}  Sequence: ${r.sequence}")
        appendLine("  Bids ($d):")
        appendLine("  %-14s  %s".format("Price", "Amount"))
        appendLine("  ──────────────  ─────────")
        r.bids.take(d).forEach { appendLine("  %-14s  %s".format(it.price, it.amount)) }
        appendLine()
        appendLine("  Asks ($d):")
        appendLine("  %-14s  %s".format("Price", "Amount"))
        appendLine("  ──────────────  ─────────")
        r.asks.take(d).forEach { appendLine("  %-14s  %s".format(it.price, it.amount)) }
    }

    fun balance(r: BalanceResult): String = buildString {
        appendLine("  %-6s  %-14s  %-14s  %-14s".format("Asset", "Total", "Available", "Locked"))
        appendLine("  %-6s  %-14s  %-14s  %-14s".format("──────", "──────────────", "──────────────", "──────────────"))
        r.balances.forEach { b ->
            appendLine("  %-6s  %-14s  %-14s  %-14s".format(b.currency.uppercase(), b.total, b.available, b.locked))
        }
    }

    fun order(r: OrderResult): String = buildString {
        appendLine("  OID: ${r.oid}")
        appendLine("  Book: ${r.book}  Side: ${r.side}  Type: ${r.type}")
        if (r.price != null) appendLine("  Price: ${r.price}")
        if (r.major != null) appendLine("  Major: ${r.major}")
        if (r.minor != null) appendLine("  Minor: ${r.minor}")
        appendLine("  Status: ${r.status ?: "unknown"}  Created: ${r.created_at ?: "n/a"}")
    }

    fun orderList(r: OrderListResult): String = buildString {
        if (r.orders.isEmpty()) {
            appendLine("  No open orders.")
        } else {
            appendLine("  %-14s  %-9s  %-4s  %-6s  %-12s  %-14s  %s".format(
                "OID", "Book", "Side", "Type", "Price", "Amount", "Status"
            ))
            appendLine("  %-14s  %-9s  %-4s  %-6s  %-12s  %-14s  %s".format(
                "──────────────", "─────────", "────", "──────", "────────────", "──────────────", "────────"
            ))
            r.orders.forEach { o ->
                val amt = o.major ?: o.minor ?: "-"
                appendLine("  %-14s  %-9s  %-4s  %-6s  %-12s  %-14s  %s".format(
                    o.oid, o.book, o.side, o.type, o.price ?: "-", amt, o.status ?: "-"
                ))
            }
        }
    }

    fun validate(r: ValidateResult): String = buildString {
        appendLine("  Status: ${r.status}")
        appendLine("  Would send:")
        appendLine("    Book:  ${r.would_send.book}")
        appendLine("    Side:  ${r.would_send.side}")
        appendLine("    Type:  ${r.would_send.type}")
        if (r.would_send.price != null) appendLine("    Price: ${r.would_send.price}")
        if (r.would_send.major != null) appendLine("    Major: ${r.would_send.major}")
        if (r.would_send.minor != null) appendLine("    Minor: ${r.would_send.minor}")
    }

    fun authTest(status: String): String = "  Auth: $status"
}