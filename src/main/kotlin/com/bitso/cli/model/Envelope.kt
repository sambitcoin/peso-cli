package com.bitso.cli.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/**
 * Unified output envelope. Every command returns exactly this shape.
 *
 * Success: `{ "schema_version": "1.0", "result": {...} }`
 * Error:   `{ "schema_version": "1.0", "error": {...} }`
 */
@Serializable
data class SuccessEnvelope<T>(
    val schema_version: String = "1.0",
    val result: T
)

@Serializable
data class ErrorEnvelope(
    val schema_version: String = "1.0",
    val error: BitsoError
)

/**
 * Structured error payload for agent consumption.
 *
 * @property category   Stable machine-readable category (auth|rate_limit|validation|api|network).
 * @property code        Machine-stable snake_case identifier. Agents should switch on this.
 * @property message     Human-readable description. May change wording between versions.
 * @property suggestion  Actionable guidance. May be empty.
 * @property retryable   Whether retrying the identical request could succeed.
 * @property docs_url    Stable documentation link, optional.
 * @property details     Original Bitso error context (code, message, HTTP status, etc.).
 */
@Serializable
data class BitsoError(
    val category: ErrorCategory,
    val code: String,
    val message: String,
    val suggestion: String = "",
    val retryable: Boolean = false,
    val docs_url: String = "",
    val details: JsonObject? = null
)

/**
 * Mapping from Bitso REST v3 error codes to our error envelope categories.
 * See: https://docs.bitso.com/bitso-api/docs/error-codes
 */
object BitsoErrorMapper {

    fun map(bitsoCode: String?, bitsoMessage: String?, httpStatus: Int): BitsoError {
        return when (bitsoCode) {
            // Auth errors
            "0201" -> BitsoError(
                category = ErrorCategory.auth,
                code = "invalid_credentials",
                message = bitsoMessage ?: "API key or secret is invalid.",
                suggestion = "Run 'bitso auth test' to verify. Regenerate keys at https://bitso.com/settings/api-keys.",
                retryable = false,
                docs_url = "https://docs.bitso.com/bitso-api/docs/authentication"
            )
            "0206" -> BitsoError(
                category = ErrorCategory.auth,
                code = "nonce_expired",
                message = bitsoMessage ?: "Nonce must be monotonically increasing.",
                suggestion = "Clock skew detected. Ensure your system clock is synced (NTP). The CLI will retry automatically.",
                retryable = false,
                docs_url = "https://docs.bitso.com/bitso-api/docs/authentication"
            )
            // Validation errors
            "0301" -> BitsoError(
                category = ErrorCategory.validation,
                code = "unknown_book",
                message = bitsoMessage ?: "Unknown order book.",
                suggestion = "Supported books include btc_usdc, eth_usdc, sol_usdc. Run 'bitso orderbook <book>' to verify.",
                retryable = false,
                docs_url = "https://docs.bitso.com/bitso-api/docs/list-order-book"
            )
            "0303" -> BitsoError(
                category = ErrorCategory.validation,
                code = "invalid_amount",
                message = bitsoMessage ?: "Invalid amount or format.",
                suggestion = "Amount must be a positive number. Use '--major' for fiat amount, '--minor' for crypto amount.",
                retryable = false
            )
            "0304" -> BitsoError(
                category = ErrorCategory.validation,
                code = "invalid_price",
                message = bitsoMessage ?: "Invalid price.",
                retryable = false
            )
            "0379" -> BitsoError(
                category = ErrorCategory.validation,
                code = "insufficient_balance",
                message = bitsoMessage ?: "Insufficient balance.",
                suggestion = "Deposit funds or reduce order size. Check balances with 'bitso balance'.",
                retryable = false
            )
            "0394" -> BitsoError(
                category = ErrorCategory.validation,
                code = "order_too_small",
                message = bitsoMessage ?: "Order amount below minimum.",
                retryable = false
            )
            "0501" -> BitsoError(
                category = ErrorCategory.validation,
                code = "precision_error",
                message = bitsoMessage ?: "Minor underflow / precision error.",
                retryable = false
            )
            // Rate limit
            "0401" -> BitsoError(
                category = ErrorCategory.rate_limit,
                code = "rate_limited",
                message = bitsoMessage ?: "Too many requests.",
                suggestion = "Bitso public limit: 60 RPM/IP. Wait and retry.",
                retryable = true
            )
            // Network / upstream errors (HTTP-level, no Bitso code)
            else -> when {
                httpStatus == 429 -> BitsoError(
                    category = ErrorCategory.rate_limit,
                    code = "rate_limited",
                    message = "Rate limited (HTTP 429).",
                    suggestion = "Wait and retry.",
                    retryable = true
                )
                httpStatus in 500..599 -> BitsoError(
                    category = ErrorCategory.network,
                    code = "http_5xx",
                    message = bitsoMessage ?: "Bitso upstream error (HTTP $httpStatus).",
                    suggestion = "Retry after a short delay.",
                    retryable = true
                )
                httpStatus == 0 || httpStatus < 0 -> BitsoError(
                    category = ErrorCategory.network,
                    code = "connection_failed",
                    message = bitsoMessage ?: "Could not connect to Bitso API.",
                    suggestion = "Check your network connection and try again.",
                    retryable = true
                )
                bitsoCode != null -> BitsoError(
                    category = ErrorCategory.api,
                    code = "unknown_api_error",
                    message = bitsoMessage ?: "Unexpected API error: $bitsoCode.",
                    retryable = false
                )
                else -> BitsoError(
                    category = ErrorCategory.api,
                    code = "unexpected_response",
                    message = bitsoMessage ?: "Unexpected response from Bitso (HTTP $httpStatus).",
                    retryable = false
                )
            }
        }
    }
}