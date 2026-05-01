package com.bitso.cli.auth

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * HMAC-SHA256 request signing for Bitso REST v3 authenticated endpoints.
 *
 * Signature formula: hex(HMAC-SHA256(api_secret, nonce + method + path + body))
 *
 * Secret handling: The [apiSecret] is stored as a [ByteArray] and zeroed
 * explicitly via [destroy]. Never converted to [String] (immutable/interned).
 * Must be called before the CLI exits for any path that loaded the secret.
 */
class Signer(apiSecret: ByteArray) {

    private val secret: ByteArray = apiSecret.copyOf()
    private var destroyed = false

    /**
     * Produces the `Authorization` header value for a Bitso API request.
     *
     * @param apiKey Bitso API key
     * @param nonce  Monotonically increasing integer (epoch-millis)
     * @param method HTTP method in uppercase ("GET", "POST", "DELETE")
     * @param path   Request path, e.g. "/api/v3/balance"
     * @param body   JSON body string for POST/PUT. Empty string for GET/DELETE.
     * @return       `"Bitso <api_key>:<nonce>:<hex_signature>"`
     */
    fun sign(apiKey: String, nonce: Long, method: String, path: String, body: String): String {
        check(!destroyed) { "Signer has been destroyed" }

        val message = "$nonce$method$path$body"
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret, "HmacSHA256"))
        val signature = mac.doFinal(message.toByteArray(Charsets.UTF_8))
        val hex = signature.joinToString("") { "%02x".format(it) }

        return "Bitso $apiKey:$nonce:$hex"
    }

    /**
     * Zeroes the secret byte array. After this, [sign] will throw.
     * Call this when the CLI is done with signed requests.
     */
    fun destroy() {
        if (!destroyed) {
            java.util.Arrays.fill(secret, 0.toByte())
            destroyed = true
        }
    }
}