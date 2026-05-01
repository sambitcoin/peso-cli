package com.bitso.cli.model

import kotlinx.serialization.Serializable

/**
 * Stable error categories for the unified JSON error envelope.
 * Agents switch on [code], not on the category name directly.
 */
@Serializable
enum class ErrorCategory {
    auth,
    rate_limit,
    validation,
    api,
    network
}