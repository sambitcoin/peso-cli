package com.bitso.cli.auth

import com.bitso.cli.model.BitsoError
import com.bitso.cli.model.ErrorCategory
import com.bitso.cli.output.JsonOutput
import com.bitso.cli.output.TableOutput
import picocli.CommandLine
import picocli.CommandLine.Command
import picocli.CommandLine.Option
import java.nio.file.Paths

@Command(
    name = "auth",
    description = ["Manage Bitso API credentials."],
    subcommands = [AuthSetCommand::class, AuthTestCommand::class]
)
class AuthCommand : Runnable {
    override fun run() {
        CommandLine.usage(this, System.err)
    }
}

@Command(
    name = "set",
    description = ["Configure API credentials and write them to ~/.config/bitso/config.toml."]
)
class AuthSetCommand : Runnable {

    @Option(names = ["--api-key"], required = true, description = ["Bitso API key."])
    lateinit var apiKey: String

    @Option(names = ["--api-secret-stdin"], description = ["Read API secret from stdin (recommended)."])
    var apiSecretStdin: Boolean = false

    @Option(names = ["--api-secret-file"], description = ["Read API secret from a file."])
    var apiSecretFile: String = ""

    @Option(
        names = ["--api-secret"],
        description = ["API secret as a direct argument (INSECURE — visible in process listing)."],
        defaultValue = "",
        // Hidden from help per plan — secret hygiene
        hidden = true
    )
    var apiSecretDirect: String = ""

    @Option(names = ["-o", "--output"], description = ["Output format: json (default) or table."], defaultValue = "json")
    var output: String = "json"

    override fun run() {
        try {
            val secretBytes: ByteArray = when {
                apiSecretStdin -> readSecretFromStdin()
                apiSecretFile.isNotBlank() -> readSecretFromFile(Paths.get(apiSecretFile))
                apiSecretDirect.isNotBlank() -> apiSecretDirect.toByteArray(Charsets.UTF_8)
                else -> throw RuntimeException("No API secret provided. Use --api-secret-stdin or --api-secret-file.")
            }

            val store = CredentialStore()
            val configPath = store.write(apiKey, secretBytes)

            // Zero the secret buffer after write
            java.util.Arrays.fill(secretBytes, 0.toByte())

            if (isJson) {
                println(JsonOutput.success(mapOf(
                    "status" to "ok",
                    "config_path" to configPath.toString()
                )))
            } else {
                println("Credentials saved to $configPath")
            }

        } catch (e: Exception) {
            val err = BitsoError(
                category = ErrorCategory.auth,
                code = "config_write_failed",
                message = e.message ?: "Failed to write credentials.",
                suggestion = "Ensure the config directory is writable."
            )
            if (isJson) println(JsonOutput.error(err))
            else System.err.println("Error: ${err.message}")
        }
    }

    private val isJson: Boolean get() = output.lowercase() == "json"
}

@Command(
    name = "test",
    description = ["Verify that the configured API credentials work by calling GET /api/v3/balance."]
)
class AuthTestCommand : Runnable {

    @Option(names = ["--api-key"], description = ["Bitso API key (overrides config)."], defaultValue = "")
    var apiKey: String = ""

    @Option(names = ["--api-secret-stdin"], description = ["Read API secret from stdin."], defaultValue = "false")
    var apiSecretStdin: Boolean = false

    @Option(names = ["--api-secret-file"], description = ["Path to file containing the API secret."], defaultValue = "")
    var apiSecretFile: String = ""

    @Option(names = ["-o", "--output"], description = ["Output format: json (default) or table."], defaultValue = "json")
    var output: String = "json"

    @Option(names = ["--api-url"], description = ["Bitso API base URL (for sandbox testing)."], defaultValue = "https://api.bitso.com")
    var apiUrl: String = "https://api.bitso.com"

    override fun run() {
        try {
            val secretBytes: ByteArray? = when {
                apiSecretStdin -> readSecretFromStdin()
                apiSecretFile.isNotBlank() -> readSecretFromFile(Paths.get(apiSecretFile))
                else -> null
            }
            val key = if (apiKey.isNotBlank()) apiKey else null
            val credentials = CredentialStore(cliApiKey = key, cliApiSecret = secretBytes).load()
            val client = AuthenticatedHttpClient(credentials, baseUrl = apiUrl)

            // Lightweight auth check — GET /api/v3/balance
            client.signedGet("/api/v3/balance")
            client.destroySigner()

            if (isJson) {
                println(JsonOutput.success(mapOf("status" to "ok")))
            } else {
                println(TableOutput.authTest("ok"))
            }

        } catch (e: CredentialMissingException) {
            val err = BitsoError(
                category = ErrorCategory.auth,
                code = "missing_credentials",
                message = e.message ?: "No credentials found.",
                suggestion = "Use 'bitso auth set --api-key <key> --api-secret-stdin' to configure."
            )
            if (isJson) println(JsonOutput.error(err))
            else System.err.println("Error: ${err.message}")
        } catch (e: BitsoApiException) {
            if (isJson) println(JsonOutput.error(e.error))
            else System.err.println("Error [${e.error.category}]: ${e.error.message}")
        }
    }

    private val isJson: Boolean get() = output.lowercase() == "json"
}