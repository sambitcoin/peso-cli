package com.bitso.cli.public

import com.bitso.cli.model.BitsoError
import com.bitso.cli.model.BitsoErrorMapper
import com.bitso.cli.model.ErrorCategory
import com.bitso.cli.model.FxInfo
import com.bitso.cli.model.TickerResult
import com.bitso.cli.output.JsonOutput
import com.bitso.cli.output.TableOutput
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import picocli.CommandLine.Command
import picocli.CommandLine.Option
import picocli.CommandLine.Parameters

@Command(
    name = "ticker",
    description = ["Get the current price of a coin in USD (or MXN with --quote mxn)."]
)
class TickerCommand : Runnable {

    @Parameters(
        index = "0",
        description = ["Coin symbol (btc, eth, sol)."]
    )
    lateinit var coin: String

    @Option(
        names = ["--quote"],
        description = ["Output currency: usd (default) or mxn."],
        defaultValue = "usd"
    )
    var quote: String = "usd"

    @Option(
        names = ["-o", "--output"],
        description = ["Output format: table (default) or json."],
        defaultValue = "table"
    )
    var output: String = "table"

    @Option(
        names = ["--api-url"],
        description = ["Bitso API base URL (for sandbox testing)."],
        defaultValue = "https://api.bitso.com"
    )
    var apiUrl: String = "https://api.bitso.com"

    override fun run() {
        try {
            val client = PublicHttpClient(baseUrl = apiUrl)

            // 1. Resolve coin to book
            val book: String
            try {
                book = BookResolver.resolve(coin)
            } catch (e: IllegalArgumentException) {
                val err = BitsoError(
                    category = ErrorCategory.validation,
                    code = "unknown_coin",
                    message = e.message ?: "Unknown coin: $coin.",
                    suggestion = "Supported coins: btc, eth, sol."
                )
                printError(err, isJson)
                return
            }

            // 2. Fetch the ticker for <coin>_usd
            val tickerJson = client.get("/api/v3/ticker", mapOf("book" to book))

            val last = tickerJson["last"]?.jsonPrimitive?.content ?: "0"
            val bid = tickerJson["bid"]?.jsonPrimitive?.content ?: "0"
            val ask = tickerJson["ask"]?.jsonPrimitive?.content ?: "0"
            val high = tickerJson["high"]?.jsonPrimitive?.content ?: "0"
            val low = tickerJson["low"]?.jsonPrimitive?.content ?: "0"
            val volume = tickerJson["volume"]?.jsonPrimitive?.content ?: "0"
            val vwap = tickerJson["vwap"]?.jsonPrimitive?.content ?: "0"

            // 3. If --quote usd, direct passthrough, no FX
            if (quote.lowercase() == "usd") {
                val result = TickerResult(
                    coin = coin.lowercase(),
                    book = book,
                    currency = "usd",
                    last = last,
                    bid = bid,
                    ask = ask,
                    high = high,
                    low = low,
                    volume = volume,
                    vwap = vwap,
                    fx = null
                )
                printResult(result, isJson)
                return
            }

            // 4. --quote mxn: fetch usd_mxn ticker and convert
            if (quote.lowercase() == "mxn") {
                val fxJson = try {
                    client.get("/api/v3/ticker", mapOf("book" to BookResolver.FX_BOOK))
                } catch (e: BitsoApiException) {
                    val err = BitsoError(
                        category = ErrorCategory.api,
                        code = "fx_unavailable",
                        message = "The ${BookResolver.FX_BOOK} book is not available.",
                        suggestion = "Try without --quote mxn for USD pricing.",
                        retryable = false
                    )
                    printError(err, isJson)
                    return
                }

                val fxBid = fxJson["bid"]?.jsonPrimitive?.content ?: "0"
                val fxAsk = fxJson["ask"]?.jsonPrimitive?.content ?: "0"
                val fxMid = BigDecimal(fxBid).add(BigDecimal(fxAsk))
                    .divide(BigDecimal("2"), 8, RoundingMode.HALF_UP)

                fun String.convert(): String {
                    if (this == "0") return "0"
                    return BigDecimal(this).multiply(fxMid)
                        .setScale(2, RoundingMode.HALF_UP)
                        .toPlainString()
                }

                val fxInfo = FxInfo(
                    rate = fxMid.toPlainString(),
                    source = "bitso:${BookResolver.FX_BOOK}",
                    source_bid = fxBid,
                    source_ask = fxAsk,
                    timestamp = Instant.now().toString()
                )

                val result = TickerResult(
                    coin = coin.lowercase(),
                    book = book,
                    currency = "mxn",
                    last = last.convert(),
                    bid = bid.convert(),
                    ask = ask.convert(),
                    high = high.convert(),
                    low = low.convert(),
                    volume = volume,
                    vwap = vwap.convert(),
                    fx = fxInfo
                )
                printResult(result, isJson)
                return
            }

            val err = BitsoError(
                category = ErrorCategory.validation,
                code = "invalid_quote",
                message = "Unsupported quote currency: $quote.",
                suggestion = "Use 'usd' or 'mxn'."
            )
            printError(err, isJson)

        } catch (e: BitsoApiException) {
            printError(e.error, isJson)
        }
    }

    private val isJson: Boolean get() = output.lowercase() == "json"

    private fun printResult(result: TickerResult, json: Boolean) {
        if (json) {
            println(JsonOutput.success(result))
        } else {
            println(TableOutput.ticker(result))
        }
    }

    private fun printError(err: BitsoError, json: Boolean) {
        if (json) {
            println(JsonOutput.error(err))
        } else {
            System.err.println("Error [${err.category}]: ${err.message}")
            if (err.suggestion.isNotEmpty()) {
                System.err.println("Suggestion: ${err.suggestion}")
            }
        }
    }
}