package com.bitso.cli.auth

import com.bitso.cli.model.BitsoError
import com.bitso.cli.model.ErrorCategory
import com.bitso.cli.model.OrderResult
import com.bitso.cli.model.OrderListResult
import com.bitso.cli.model.PlaceOrderRequest
import com.bitso.cli.model.ValidateResult
import com.bitso.cli.output.JsonOutput
import com.bitso.cli.output.TableOutput
import kotlinx.serialization.json.*
import picocli.CommandLine
import picocli.CommandLine.Command
import picocli.CommandLine.Option
import picocli.CommandLine.Parameters
import java.math.BigDecimal

/**
 * Entry point for `bitso order <subcommand>`. Routes to buy/sell/list.
 */
@Command(
    name = "order",
    description = ["Place or manage orders."],
    subcommands = [OrderBuyCommand::class, OrderSellCommand::class, OrderListCommand::class]
)
class OrderCommand : Runnable {
    override fun run() {
        // picocli prints usage for the parent command
        CommandLine.usage(this, System.err)
    }
}

@Command(
    name = "buy",
    description = ["Place a buy order."]
)
class OrderBuyCommand : Runnable {

    @Parameters(
        index = "0",
        description = ["Order book (e.g., btc_usdc, eth_usdc, sol_usdc)."]
    )
    lateinit var book: String

    @Option(names = ["--type"], required = true, description = ["Order type: market or limit."])
    lateinit var type: String

    @Option(names = ["--major"], description = ["Amount in major (fiat) currency."])
    var major: String? = null

    @Option(names = ["--minor"], description = ["Amount in minor (crypto) currency."])
    var minor: String? = null

    @Option(names = ["--price"], description = ["Price (required for limit orders)."])
    var price: String? = null

    @Option(names = ["--validate"], description = ["Dry-run: validate parameters only. Does not call API."])
    var validate: Boolean = false

    @Option(names = ["--client-id"], description = ["Client-specified order ID for idempotency."])
    var clientId: String? = null

    @Option(names = ["--api-key"], description = ["Bitso API key."], defaultValue = "")
    var apiKey: String = ""

    @Option(names = ["--api-secret-stdin"], description = ["Read API secret from stdin."], defaultValue = "false")
    var apiSecretStdin: Boolean = false

    @Option(names = ["--api-secret-file"], description = ["Path to file containing the API secret."], defaultValue = "")
    var apiSecretFile: String = ""

    @Option(names = ["-o", "--output"], description = ["Output format: json (default) or table."], defaultValue = "json")
    var output: String = "json"

    @Option(names = ["--api-url"], description = ["Bitso API base URL (for sandbox testing)."], defaultValue = "https://api.bitso.com")
    var apiUrl: String = "https://api.bitso.com"

    override fun run() {
        try {
            // Client-side validation
            val validationError = validateParams(book)
            if (validationError != null) {
                printError(validationError)
                return
            }

            val request = PlaceOrderRequest(
                book = book,
                side = "buy",
                type = type.lowercase(),
                major = major,
                minor = minor,
                price = price,
                client_id = clientId
            )

            if (validate) {
                val result = ValidateResult(would_send = request)
                if (isJson) {
                    println(JsonOutput.success(result))
                } else {
                    println(TableOutput.validate(result))
                }
                return
            }

            // Real API call
            val credentials = loadCredentials()
            val client = AuthenticatedHttpClient(credentials, baseUrl = apiUrl)

            val body = buildJsonObject {
                put("book", request.book)
                put("side", request.side)
                put("type", request.type)
                if (request.major != null) put("major", request.major)
                if (request.minor != null) put("minor", request.minor)
                if (request.price != null) put("price", request.price)
                if (request.client_id != null) put("client_id", request.client_id)
            }

            val response = client.signedPost("/api/v3/orders", body)
            client.destroySigner()

            val result = OrderResult(
                oid = response["oid"]?.jsonPrimitive?.content ?: "?",
                book = book,
                side = "buy",
                type = type.lowercase(),
                price = price,
                major = major,
                minor = minor,
                created_at = response["created_at"]?.jsonPrimitive?.content,
                status = response["status"]?.jsonPrimitive?.content
            )

            if (isJson) {
                println(JsonOutput.success(result))
            } else {
                println(TableOutput.order(result))
            }

        } catch (e: CredentialMissingException) {
            val err = BitsoError(
                category = ErrorCategory.auth,
                code = "missing_credentials",
                message = e.message ?: "No credentials found.",
                suggestion = "Use 'bitso auth set --api-key <key> --api-secret-stdin' to configure."
            )
            printError(err)
        } catch (e: BitsoApiException) {
            printError(e.error)
        }
    }

    private fun validateParams(book: String): BitsoError? {
        val normalizedType = type.lowercase()
        if (normalizedType != "market" && normalizedType != "limit") {
            return BitsoError(
                category = ErrorCategory.validation,
                code = "invalid_order_type",
                message = "Order type must be 'market' or 'limit'.",
                retryable = false
            )
        }

        if (normalizedType == "limit" && price == null) {
            return BitsoError(
                category = ErrorCategory.validation,
                code = "missing_price",
                message = "--price is required for limit orders.",
                retryable = false
            )
        }

        if (major != null && minor != null) {
            return BitsoError(
                category = ErrorCategory.validation,
                code = "ambiguous_amount",
                message = "Specify --major or --minor, not both.",
                retryable = false
            )
        }

        if (major != null) {
            try { if (BigDecimal(major) <= BigDecimal.ZERO) throw NumberFormatException() }
            catch (_: NumberFormatException) {
                return BitsoError(
                    category = ErrorCategory.validation,
                    code = "invalid_amount",
                    message = "--major must be a positive number.",
                    retryable = false
                )
            }
        }

        if (minor != null) {
            try { if (BigDecimal(minor) <= BigDecimal.ZERO) throw NumberFormatException() }
            catch (_: NumberFormatException) {
                return BitsoError(
                    category = ErrorCategory.validation,
                    code = "invalid_amount",
                    message = "--minor must be a positive number.",
                    retryable = false
                )
            }
        }

        if (major == null && minor == null) {
            return BitsoError(
                category = ErrorCategory.validation,
                code = "missing_amount",
                message = "Specify either --major or --minor amount.",
                retryable = false
            )
        }

        if (price != null) {
            try { if (BigDecimal(price) <= BigDecimal.ZERO) throw NumberFormatException() }
            catch (_: NumberFormatException) {
                return BitsoError(
                    category = ErrorCategory.validation,
                    code = "invalid_price",
                    message = "--price must be a positive number.",
                    retryable = false
                )
            }
        }

        // Basic book syntax check
        if (!book.matches(Regex("^[a-z]{3,4}_[a-z]{3,4}$"))) {
            return BitsoError(
                category = ErrorCategory.validation,
                code = "invalid_book_format",
                message = "Book must be in format 'xxx_yyy' (e.g., btc_usdc).",
                retryable = false
            )
        }

        return null
    }

    private val isJson: Boolean get() = output.lowercase() == "json"

    private fun loadCredentials(): CredentialStore.Credentials {
        val secretBytes: ByteArray? = when {
            apiSecretStdin -> readSecretFromStdin()
            apiSecretFile.isNotBlank() -> readSecretFromFile(java.nio.file.Paths.get(apiSecretFile))
            else -> null
        }
        val key = if (apiKey.isNotBlank()) apiKey else null
        return CredentialStore(cliApiKey = key, cliApiSecret = secretBytes).load()
    }

    private fun printError(err: BitsoError) {
        if (isJson) {
            println(JsonOutput.error(err))
        } else {
            System.err.println("Error [${err.category}]: ${err.message}")
            if (err.suggestion.isNotEmpty()) System.err.println("Suggestion: ${err.suggestion}")
        }
    }
}

@Command(
    name = "sell",
    description = ["Place a sell order."]
)
class OrderSellCommand : Runnable {

    @Parameters(
        index = "0",
        description = ["Order book (e.g., btc_usdc, eth_usdc, sol_usdc)."]
    )
    lateinit var book: String

    @Option(names = ["--type"], required = true, description = ["Order type: market or limit."])
    lateinit var type: String

    @Option(names = ["--major"], description = ["Amount in major (fiat) currency."])
    var major: String? = null

    @Option(names = ["--minor"], description = ["Amount in minor (crypto) currency."])
    var minor: String? = null

    @Option(names = ["--price"], description = ["Price (required for limit orders)."])
    var price: String? = null

    @Option(names = ["--validate"], description = ["Dry-run: validate parameters only. Does not call API."])
    var validate: Boolean = false

    @Option(names = ["--client-id"], description = ["Client-specified order ID for idempotency."])
    var clientId: String? = null

    @Option(names = ["--api-key"], description = ["Bitso API key."], defaultValue = "")
    var apiKey: String = ""

    @Option(names = ["--api-secret-stdin"], description = ["Read API secret from stdin."], defaultValue = "false")
    var apiSecretStdin: Boolean = false

    @Option(names = ["--api-secret-file"], description = ["Path to file containing the API secret."], defaultValue = "")
    var apiSecretFile: String = ""

    @Option(names = ["-o", "--output"], description = ["Output format: json (default) or table."], defaultValue = "json")
    var output: String = "json"

    @Option(names = ["--api-url"], description = ["Bitso API base URL (for sandbox testing)."], defaultValue = "https://api.bitso.com")
    var apiUrl: String = "https://api.bitso.com"

    override fun run() {
        try {
            val validationError = validateParams(book)
            if (validationError != null) {
                printError(validationError)
                return
            }

            val request = PlaceOrderRequest(
                book = book,
                side = "sell",
                type = type.lowercase(),
                major = major,
                minor = minor,
                price = price,
                client_id = clientId
            )

            if (validate) {
                val result = ValidateResult(would_send = request)
                if (isJson) println(JsonOutput.success(result))
                else println(TableOutput.validate(result))
                return
            }

            val credentials = loadCredentials()
            val client = AuthenticatedHttpClient(credentials, baseUrl = apiUrl)

            val body = buildJsonObject {
                put("book", request.book)
                put("side", request.side)
                put("type", request.type)
                if (request.major != null) put("major", request.major)
                if (request.minor != null) put("minor", request.minor)
                if (request.price != null) put("price", request.price)
                if (request.client_id != null) put("client_id", request.client_id)
            }

            val response = client.signedPost("/api/v3/orders", body)
            client.destroySigner()

            val result = OrderResult(
                oid = response["oid"]?.jsonPrimitive?.content ?: "?",
                book = book,
                side = "sell",
                type = type.lowercase(),
                price = price,
                major = major,
                minor = minor,
                created_at = response["created_at"]?.jsonPrimitive?.content,
                status = response["status"]?.jsonPrimitive?.content
            )

            if (isJson) println(JsonOutput.success(result))
            else println(TableOutput.order(result))

        } catch (e: CredentialMissingException) {
            val err = BitsoError(
                category = ErrorCategory.auth,
                code = "missing_credentials",
                message = e.message ?: "No credentials found.",
                suggestion = "Use 'bitso auth set --api-key <key> --api-secret-stdin' to configure."
            )
            printError(err)
        } catch (e: BitsoApiException) {
            printError(e.error)
        }
    }

    private fun validateParams(book: String): BitsoError? {
        val normalizedType = type.lowercase()
        if (normalizedType != "market" && normalizedType != "limit") {
            return BitsoError(
                category = ErrorCategory.validation,
                code = "invalid_order_type",
                message = "Order type must be 'market' or 'limit'.",
                retryable = false
            )
        }
        if (normalizedType == "limit" && price == null) {
            return BitsoError(
                category = ErrorCategory.validation,
                code = "missing_price",
                message = "--price is required for limit orders.",
                retryable = false
            )
        }
        if (major != null && minor != null) {
            return BitsoError(
                category = ErrorCategory.validation,
                code = "ambiguous_amount",
                message = "Specify --major or --minor, not both.",
                retryable = false
            )
        }
        if (major != null) {
            try { if (BigDecimal(major) <= BigDecimal.ZERO) throw NumberFormatException() }
            catch (_: NumberFormatException) {
                return BitsoError(
                    category = ErrorCategory.validation,
                    code = "invalid_amount",
                    message = "--major must be a positive number.",
                    retryable = false
                )
            }
        }
        if (minor != null) {
            try { if (BigDecimal(minor) <= BigDecimal.ZERO) throw NumberFormatException() }
            catch (_: NumberFormatException) {
                return BitsoError(
                    category = ErrorCategory.validation,
                    code = "invalid_amount",
                    message = "--minor must be a positive number.",
                    retryable = false
                )
            }
        }
        if (major == null && minor == null) {
            return BitsoError(
                category = ErrorCategory.validation,
                code = "missing_amount",
                message = "Specify either --major or --minor amount.",
                retryable = false
            )
        }
        if (price != null) {
            try { if (BigDecimal(price) <= BigDecimal.ZERO) throw NumberFormatException() }
            catch (_: NumberFormatException) {
                return BitsoError(
                    category = ErrorCategory.validation,
                    code = "invalid_price",
                    message = "--price must be a positive number.",
                    retryable = false
                )
            }
        }
        if (!book.matches(Regex("^[a-z]{3,4}_[a-z]{3,4}$"))) {
            return BitsoError(
                category = ErrorCategory.validation,
                code = "invalid_book_format",
                message = "Book must be in format 'xxx_yyy' (e.g., btc_usdc).",
                retryable = false
            )
        }
        return null
    }

    private val isJson: Boolean get() = output.lowercase() == "json"

    private fun loadCredentials(): CredentialStore.Credentials {
        val secretBytes: ByteArray? = when {
            apiSecretStdin -> readSecretFromStdin()
            apiSecretFile.isNotBlank() -> readSecretFromFile(java.nio.file.Paths.get(apiSecretFile))
            else -> null
        }
        val key = if (apiKey.isNotBlank()) apiKey else null
        return CredentialStore(cliApiKey = key, cliApiSecret = secretBytes).load()
    }

    private fun printError(err: BitsoError) {
        if (isJson) {
            println(JsonOutput.error(err))
        } else {
            System.err.println("Error [${err.category}]: ${err.message}")
            if (err.suggestion.isNotEmpty()) System.err.println("Suggestion: ${err.suggestion}")
        }
    }
}

@Command(
    name = "list",
    description = ["List open orders. Optionally filter by book."]
)
class OrderListCommand : Runnable {

    @Option(names = ["--book"], description = ["Filter by book (e.g., btc_usdc). Shows all if omitted."])
    var book: String? = null

    @Option(names = ["--api-key"], description = ["Bitso API key."], defaultValue = "")
    var apiKey: String = ""

    @Option(names = ["--api-secret-stdin"], description = ["Read API secret from stdin."], defaultValue = "false")
    var apiSecretStdin: Boolean = false

    @Option(names = ["--api-secret-file"], description = ["Path to file containing the API secret."], defaultValue = "")
    var apiSecretFile: String = ""

    @Option(names = ["-o", "--output"], description = ["Output format: json (default) or table."], defaultValue = "json")
    var output: String = "json"

    @Option(names = ["--api-url"], description = ["Bitso API base URL (for sandbox testing)."], defaultValue = "https://api.bitso.com")
    var apiUrl: String = "https://api.bitso.com"

    override fun run() {
        try {
            val credentials = loadCredentials()
            val client = AuthenticatedHttpClient(credentials, baseUrl = apiUrl)

            val params = book?.let { mapOf("book" to it) } ?: emptyMap()
            val payload = client.signedGet("/api/v3/open_orders", params)
            client.destroySigner()

            val orders = payload["orders"]?.jsonArray?.map { el ->
                val obj = el.jsonObject
                OrderResult(
                    oid = obj["oid"]?.jsonPrimitive?.content ?: "?",
                    book = obj["book"]?.jsonPrimitive?.content ?: "?",
                    side = obj["side"]?.jsonPrimitive?.content ?: "?",
                    type = obj["type"]?.jsonPrimitive?.content ?: "?",
                    price = obj["price"]?.jsonPrimitive?.content,
                    major = obj["major"]?.jsonPrimitive?.content,
                    minor = obj["minor"]?.jsonPrimitive?.content,
                    created_at = obj["created_at"]?.jsonPrimitive?.content,
                    status = obj["status"]?.jsonPrimitive?.content,
                    filled = obj["filled"]?.jsonPrimitive?.content
                )
            } ?: emptyList()

            val result = OrderListResult(orders = orders)

            if (isJson) {
                println(JsonOutput.success(result))
            } else {
                println(TableOutput.orderList(result))
            }

        } catch (e: CredentialMissingException) {
            val err = BitsoError(
                category = ErrorCategory.auth,
                code = "missing_credentials",
                message = e.message ?: "No credentials found.",
                suggestion = "Use 'bitso auth set --api-key <key> --api-secret-stdin' to configure."
            )
            printError(err)
        } catch (e: BitsoApiException) {
            printError(e.error)
        }
    }

    private val isJson: Boolean get() = output.lowercase() == "json"

    private fun loadCredentials(): CredentialStore.Credentials {
        val secretBytes: ByteArray? = when {
            apiSecretStdin -> readSecretFromStdin()
            apiSecretFile.isNotBlank() -> readSecretFromFile(java.nio.file.Paths.get(apiSecretFile))
            else -> null
        }
        val key = if (apiKey.isNotBlank()) apiKey else null
        return CredentialStore(cliApiKey = key, cliApiSecret = secretBytes).load()
    }

    private fun printError(err: BitsoError) {
        if (isJson) {
            println(JsonOutput.error(err))
        } else {
            System.err.println("Error [${err.category}]: ${err.message}")
            if (err.suggestion.isNotEmpty()) System.err.println("Suggestion: ${err.suggestion}")
        }
    }
}