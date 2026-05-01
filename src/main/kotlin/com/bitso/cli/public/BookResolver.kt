package com.bitso.cli.public

/**
 * Resolves a coin symbol (btc, eth, sol) to its Bitso book.
 *
 * Every supported coin has a `<coin>_usd` book on Bitso.
 * This map is a compile-time constant — no `available_books` fetch needed.
 */
object BookResolver {

    /**
     * Map of supported coin symbols (lowercase) to their Bitso USD-quoted books.
     */
    private val coinToBook: Map<String, String> = mapOf(
        "btc" to "btc_usd",
        "eth" to "eth_usd",
        "sol" to "sol_usd"
    )

    val supportedCoins: Set<String> get() = coinToBook.keys

    /**
     * Resolves a coin symbol to a Bitso book.
     *
     * @param coin  The coin symbol (case-insensitive, e.g. "BTC", "Eth")
     * @return      The Bitso book string (e.g. "btc_usdc")
     * @throws      IllegalArgumentException if the coin is not supported
     */
    fun resolve(coin: String): String {
        val normalized = coin.lowercase()
        return coinToBook[normalized]
            ?: throw IllegalArgumentException("Unknown coin: $coin. Supported: ${supportedCoins.joinToString()}")
    }

    /**
     * The FX book used for MXN conversion. Bitso uses `usd_mxn`.
     */
    const val FX_BOOK = "usd_mxn"
}