package com.bitso.cli.model

import kotlinx.serialization.Serializable

@Serializable
data class BitsoOrderPlacePayload(
    val oid: String? = null,
    val book: String? = null,
    val side: String? = null,
    val type: String? = null,
    val price: String? = null,
    val major: String? = null,
    val minor: String? = null,
    val created_at: String? = null,
    val status: String? = null
)

@Serializable
data class BitsoOpenOrdersPayload(
    val orders: List<BitsoOrderPlacePayload> = emptyList()
)

@Serializable
data class OrderResult(
    val oid: String,
    val book: String,
    val side: String,
    val type: String,
    val price: String? = null,
    val major: String? = null,
    val minor: String? = null,
    val created_at: String? = null,
    val status: String? = null,
    val filled: String? = null
)

@Serializable
data class OrderListResult(
    val orders: List<OrderResult>
)

/**
 * Body sent to `POST /api/v3/orders`.
 */
@Serializable
data class PlaceOrderRequest(
    val book: String,
    val side: String,  // "buy" | "sell"
    val type: String,  // "market" | "limit"
    val major: String? = null,
    val minor: String? = null,
    val price: String? = null,
    val client_id: String? = null
)

/**
 * Result from `bitso order <buy|sell> --validate`.
 * Client-side only — never calls the API.
 */
@Serializable
data class ValidateResult(
    val status: String = "valid",
    val would_send: PlaceOrderRequest
)