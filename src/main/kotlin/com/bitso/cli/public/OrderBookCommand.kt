package com.bitso.cli.public

import com.bitso.cli.model.BitsoError
import com.bitso.cli.model.ErrorCategory
import com.bitso.cli.model.OrderBookResult
import com.bitso.cli.output.JsonOutput
import com.bitso.cli.output.TableOutput
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import picocli.CommandLine.Command
import picocli.CommandLine.Option
import picocli.CommandLine.Parameters

@Command(
    name = "orderbook",
    description = ["View the order book for a given Bitso book (bids and asks)."]
)
class OrderBookCommand : Runnable {

    @Parameters(
        index = "0",
        description = ["Book name (e.g. btc_usdc, eth_usdc, sol_usdc)."]
    )
    lateinit var book: String

    @Option(
        names = ["--depth"],
        description = ["Number of price levels to show (per side). Shows all if not set."],
        defaultValue = "-1"
    )
    var depth: Int = -1

    @Option(
        names = ["-o", "--output"],
        description = ["Output format: json (default) or table."],
        defaultValue = "json"
    )
    var output: String = "json"

    @Option(
        names = ["--api-url"],
        description = ["Bitso API base URL (for sandbox testing)."],
        defaultValue = "https://api.bitso.com"
    )
    var apiUrl: String = "https://api.bitso.com"

    override fun run() {
        try {
            val client = PublicHttpClient(baseUrl = apiUrl)

            val params = mutableMapOf("book" to book, "aggregate" to "true")
            val body = client.get("/api/v3/order_book", params)

            val sequence = body["sequence"]?.jsonPrimitive?.content ?: "0"

            fun parseLevels(json: kotlinx.serialization.json.JsonElement?): List<com.bitso.cli.model.OrderBookEntry> {
                if (json == null) return emptyList()
                return json.jsonArray.map { el ->
                    val obj = el.jsonObject
                    com.bitso.cli.model.OrderBookEntry(
                        price = obj["price"]?.jsonPrimitive?.content ?: "0",
                        amount = obj["amount"]?.jsonPrimitive?.content ?: "0"
                    )
                }
            }

            val bids = parseLevels(body["bids"])
            val asks = parseLevels(body["asks"])

            val result = OrderBookResult(
                book = book,
                sequence = sequence,
                bids = bids,
                asks = asks
            )

            if (isJson) {
                println(JsonOutput.success(result))
            } else {
                val showDepth = if (depth > 0) depth else Int.MAX_VALUE
                println(TableOutput.orderBook(result, showDepth))
            }

        } catch (e: BitsoApiException) {
            printError(e.error)
        }
    }

    private val isJson: Boolean get() = output.lowercase() == "json"

    private fun printError(err: BitsoError) {
        if (isJson) {
            println(JsonOutput.error(err))
        } else {
            System.err.println("Error [${err.category}]: ${err.message}")
            if (err.suggestion.isNotEmpty()) {
                System.err.println("Suggestion: ${err.suggestion}")
            }
        }
    }
}