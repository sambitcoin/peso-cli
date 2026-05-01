package com.bitso.cli.public

import com.bitso.cli.model.BitsoError
import com.bitso.cli.model.BitsoErrorMapper
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.boolean
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/**
 * HTTP client for **public** Bitso REST v3 endpoints only.
 * This class NEVER imports or references any auth/signing code.
 * It can run on a machine with zero credentials configured.
 */
class PublicHttpClient(
    private val baseUrl: String = "https://api.bitso.com",
    private val timeoutSeconds: Long = 30
) {
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(timeoutSeconds))
        .version(HttpClient.Version.HTTP_2)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    /**
     * Performs a GET request and unwraps Bitso's `{ success, payload }` envelope.
     *
     * @param path   API path, e.g. "/api/v3/ticker"
     * @param params Optional query parameters
     * @return       The parsed payload body as a [JsonObject]
     */
    fun get(path: String, params: Map<String, String> = emptyMap()): JsonObject {
        val query = if (params.isNotEmpty()) {
            params.entries.joinToString("&") { "${it.key}=${it.value}" }.let { "?$it" }
        } else ""

        val request = HttpRequest.newBuilder()
            .uri(URI.create("$baseUrl$path$query"))
            .GET()
            .timeout(Duration.ofSeconds(timeoutSeconds))
            .build()

        return execute(request)
    }

    private fun execute(request: HttpRequest): JsonObject {
        val response = try {
            httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        } catch (e: Exception) {
            throw BitsoApiException(
                BitsoErrorMapper.map(null, e.message, 0)
            )
        }

        val body = try {
            json.parseToJsonElement(response.body()).jsonObject
        } catch (e: Exception) {
            throw BitsoApiException(
                BitsoErrorMapper.map(null, "Failed to parse response body", response.statusCode())
            )
        }

        val success = body["success"]?.jsonPrimitive?.boolean ?: false

        if (!success) {
            val errorObj = body["error"]?.jsonObject
            val code = errorObj?.get("code")?.jsonPrimitive?.content
            val message = errorObj?.get("message")?.jsonPrimitive?.content
            throw BitsoApiException(
                BitsoErrorMapper.map(code, message, response.statusCode())
            )
        }

        return body["payload"]?.jsonObject
            ?: throw BitsoApiException(
                BitsoErrorMapper.map(null, "Payload missing from response", response.statusCode())
            )
    }
}

/**
 * Exception wrapping a structured [BitsoError]. Caught by command handlers
 * and rendered into the error envelope.
 */
class BitsoApiException(val error: BitsoError) : RuntimeException(error.message)