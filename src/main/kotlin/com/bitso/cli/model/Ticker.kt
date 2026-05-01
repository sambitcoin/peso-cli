package com.bitso.cli.model

import kotlinx.serialization.Serializable

/**
 * Parsed from Bitso's `GET /api/v3/ticker?book=<book>` response payload.
 * Fields match Bitso's API directly.
 */
@Serializable
data class BitsoTickerPayload(
    val book: String,
    val last: String,
    val high: String,
    val low: String,
    val vwap: String,
    val volume: String,
    val bid: String,
    val ask: String
)

/**
 * Our enriched ticker output, always in USD by default.
 * When `--quote mxn` is requested, [fx] is populated.
 */
@Serializable
data class TickerResult(
    val coin: String,
    val book: String,
    val currency: String, // "usd" or "mxn"
    val last: String,
    val bid: String,
    val ask: String,
    val high: String,
    val low: String,
    val volume: String,
    val vwap: String,
    val fx: FxInfo? = null
)

/**
 * FX conversion provenance. Only present when the output currency differs
 * from the native book currency (i.e., `--quote mxn` was requested).
 */
@Serializable
data class FxInfo(
    val rate: String,
    val source: String,       // e.g. "bitso:usd_mxn"
    val source_bid: String,
    val source_ask: String,
    val timestamp: String      // ISO-8601 from Bitso's ticker timestamp
)