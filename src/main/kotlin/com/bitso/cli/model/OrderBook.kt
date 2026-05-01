package com.bitso.cli.model

import kotlinx.serialization.Serializable

@Serializable
data class OrderBookEntry(
    val price: String,
    val amount: String
)

@Serializable
data class BitsoOrderBookPayload(
    val sequence: String,
    val bids: List<OrderBookEntry>,
    val asks: List<OrderBookEntry>
)

@Serializable
data class OrderBookResult(
    val book: String,
    val sequence: String,
    val bids: List<OrderBookEntry>,
    val asks: List<OrderBookEntry>
)