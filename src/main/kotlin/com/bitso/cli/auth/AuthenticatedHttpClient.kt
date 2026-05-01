package com.bitso.cli.auth

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
 * HTTP client for **authenticated** Bitso REST v3 endpoints.
 * Decorates every request with HMAC-SHA256 signing.
 * Lives in the `auth` module — never imported by public commands.
 */
class AuthenticatedHttpClient(
    private val credentials: CredentialStore.Credentials,
    private val baseUrl: String = "https://api.bitso.com",
    private val timeoutSeconds: Long = 30
) {
    private val signer = Signer(credentials.apiSecret)
    private val apiKey = credentials.apiKey

    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(timeoutSeconds))
        .version(HttpClient.Version.HTTP_2)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    /**
     * Performs a signed GET request.
     */
    fun signedGet(path: String, params: Map<String, String> = emptyMap()): JsonObject {
        val query = if (params.isNotEmpty()) {
            params.entries.joinToString("&") { "${it.key}=${it.value}" }.let { "?$it" }
        } else ""

        val nonce = System.currentTimeMillis()
        val rawPath = path + query
        val authHeader = signer.sign(apiKey, nonce, "GET", path, "")

        val request = HttpRequest.newBuilder()
            .uri(URI.create("$baseUrl$rawPath"))
            .GET()
            .header("Authorization", authHeader)
            .timeout(Duration.ofSeconds(timeoutSeconds))
            .build()

        return execute(request)
    }

    /**
     * Performs a signed POST request with a JSON body.
     */
    fun signedPost(path: String, body: JsonObject): JsonObject {
        val bodyString = json.encodeToString(JsonObject.serializer(), body)
        val nonce = System.currentTimeMillis()
        val authHeader = signer.sign(apiKey, nonce, "POST", path, bodyString)

        val request = HttpRequest.newBuilder()
            .uri(URI.create("$baseUrl$path"))
            .POST(HttpRequest.BodyPublishers.ofString(bodyString))
            .header("Authorization", authHeader)
            .header("Content-Type", "application/json")
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

    fun destroySigner() {
        signer.destroy()
    }
}

class BitsoApiException(val error: BitsoError) : RuntimeException(error.message)