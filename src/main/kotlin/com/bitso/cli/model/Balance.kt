package com.bitso.cli.model

import kotlinx.serialization.Serializable

@Serializable
data class BalanceEntry(
    val currency: String,
    val total: String,
    val available: String,
    val locked: String
)

@Serializable
data class BitsoBalancePayload(
    val balances: List<BalanceEntry>
)

@Serializable
data class BalanceResult(
    val balances: List<BalanceEntry>
)