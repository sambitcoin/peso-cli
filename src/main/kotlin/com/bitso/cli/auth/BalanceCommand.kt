package com.bitso.cli.auth

import com.bitso.cli.model.BalanceResult
import com.bitso.cli.model.BitsoError
import com.bitso.cli.output.JsonOutput
import com.bitso.cli.output.TableOutput
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import picocli.CommandLine.Command
import picocli.CommandLine.Option

@Command(
    name = "balance",
    description = ["Show account balances for all assets."]
)
class BalanceCommand : Runnable {

    @Option(
        names = ["--api-key"],
        description = ["Bitso API key."],
        defaultValue = ""
    )
    var apiKey: String = ""

    @Option(
        names = ["--api-secret-stdin"],
        description = ["Read API secret from stdin."],
        defaultValue = "false"
    )
    var apiSecretStdin: Boolean = false

    @Option(
        names = ["--api-secret-file"],
        description = ["Path to file containing the API secret."],
        defaultValue = ""
    )
    var apiSecretFile: String = ""

    @Option(
        names = ["-o", "--output"],
        description = ["Output format: json (default) or table."],
        defaultValue = "json"
    )
    var output: String = "json"

    @Option(
        names = ["--api-url"],
        description = ["Bitso API base URL (for sandbox testing)."],
        defaultValue = "https://api.bitso.com"
    )
    var apiUrl: String = "https://api.bitso.com"

    override fun run() {
        try {
            val credentials = loadCredentials()
            val client = AuthenticatedHttpClient(credentials, baseUrl = apiUrl)

            val payload = client.signedGet("/api/v3/balance")

            val balances = payload["balances"]?.jsonArray?.map { el ->
                val obj = el.jsonObject
                com.bitso.cli.model.BalanceEntry(
                    currency = obj["currency"]?.jsonPrimitive?.content ?: "?",
                    total = obj["total"]?.jsonPrimitive?.content ?: "0",
                    available = obj["available"]?.jsonPrimitive?.content ?: "0",
                    locked = obj["locked"]?.jsonPrimitive?.content ?: "0"
                )
            } ?: emptyList()

            val result = BalanceResult(balances = balances)

            client.destroySigner()

            if (isJson) {
                println(JsonOutput.success(result))
            } else {
                println(TableOutput.balance(result))
            }

        } catch (e: CredentialMissingException) {
            val err = BitsoError(
                category = com.bitso.cli.model.ErrorCategory.auth,
                code = "missing_credentials",
                message = e.message ?: "No credentials found.",
                suggestion = "Use 'bitso auth set --api-key <key> --api-secret-stdin' to configure."
            )
            printError(err)
        } catch (e: BitsoApiException) {
            printError(e.error)
        }
    }

    private val isJson: Boolean get() = output.lowercase() == "json"

    private fun loadCredentials(): CredentialStore.Credentials {
        val secretBytes: ByteArray? = when {
            apiSecretStdin -> readSecretFromStdin()
            apiSecretFile.isNotBlank() -> readSecretFromFile(java.nio.file.Paths.get(apiSecretFile))
            else -> null
        }
        val key = if (apiKey.isNotBlank()) apiKey else null
        return CredentialStore(cliApiKey = key, cliApiSecret = secretBytes).load()
    }

    private fun printError(err: BitsoError) {
        if (isJson) {
            println(JsonOutput.error(err))
        } else {
            System.err.println("Error [${err.category}]: ${err.message}")
            if (err.suggestion.isNotEmpty()) {
                System.err.println("Suggestion: ${err.suggestion}")
            }
        }
    }
}