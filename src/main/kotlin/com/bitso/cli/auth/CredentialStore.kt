package com.bitso.cli.auth

import com.bitso.cli.model.BitsoError
import com.bitso.cli.model.ErrorCategory
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermission
import java.nio.file.attribute.PosixFilePermissions

/**
 * Credential precedence: CLI flag > env var > config file.
 *
 * Lazily loaded — never instantiated by public commands.
 * The config file lives at `~/.config/bitso/config.toml` (Unix)
 * or `%APPDATA%\bitso\config.toml` (Windows).
 * Directories created with 0700, file with 0600 on Unix.
 */
class CredentialStore(
    private val cliApiKey: String? = null,
    private val cliApiSecret: ByteArray? = null
) {
    private val configDir: Path = resolveConfigDir()
    private val configFile: Path = configDir.resolve("config.toml")

    data class Credentials(
        val apiKey: String,
        val apiSecret: ByteArray
    )

    /**
     * Loads credentials in precedence order, throwing if none found.
     */
    fun load(): Credentials {
        // 1. CLI flag
        if (cliApiKey != null && cliApiSecret != null) {
            return Credentials(cliApiKey, cliApiSecret.copyOf())
        }

        // 2. Environment variables
        val envKey = System.getenv("BITSO_API_KEY")
        val envSecret = System.getenv("BITSO_API_SECRET")
        if (!envKey.isNullOrBlank() && !envSecret.isNullOrBlank()) {
            return Credentials(envKey, envSecret.toByteArray(Charsets.UTF_8))
        }

        // 3. Config file
        if (Files.exists(configFile)) {
            val config = parseConfigFile()
            if (config != null) return config
        }

        throw CredentialMissingException()
    }

    /**
     * Writes credentials to config file. Creates directory with restricted permissions.
     */
    fun write(apiKey: String, apiSecret: ByteArray): Path {
        Files.createDirectories(configDir)

        try {
            val perms = PosixFilePermissions.fromString("rwx------")
            Files.setPosixFilePermissions(configDir, perms)
        } catch (_: UnsupportedOperationException) {
            // Windows — POSIX not supported, ACL via icacls is out of scope for MVP
        }

        val body = """
            [api]
            key = "$apiKey"
            secret = "${String(apiSecret, Charsets.UTF_8)}"
        """.trimIndent()

        Files.writeString(configFile, body)

        try {
            val perms = PosixFilePermissions.fromString("rw-------")
            Files.setPosixFilePermissions(configFile, perms)
        } catch (_: UnsupportedOperationException) {
            // Windows
        }

        return configFile
    }

    private fun parseConfigFile(): Credentials? {
        var apiKey: String? = null
        var apiSecret: String? = null

        val lines = Files.readAllLines(configFile)
        for (line in lines) {
            val trimmed = line.trim()
            when {
                trimmed.startsWith("key =") -> {
                    apiKey = trimmed.substringAfter("\"").substringBeforeLast("\"")
                }
                trimmed.startsWith("secret =") -> {
                    apiSecret = trimmed.substringAfter("\"").substringBeforeLast("\"")
                }
            }
        }

        return if (apiKey != null && apiSecret != null) {
            Credentials(apiKey, apiSecret!!.toByteArray(Charsets.UTF_8))
        } else null
    }

    companion object {
        fun resolveConfigDir(): Path {
            val home = System.getProperty("user.home")
            val osName = System.getProperty("os.name").lowercase()

            return if (osName.contains("win")) {
                // %APPDATA%\bitso or fallback to ~\AppData\Roaming\bitso
                val appData = System.getenv("APPDATA")
                    ?: Paths.get(home, "AppData", "Roaming").toString()
                Paths.get(appData, "bitso")
            } else {
                // XDG base dir or ~/.config/bitso
                val xdgConfig = System.getenv("XDG_CONFIG_HOME")
                if (xdgConfig != null) {
                    Paths.get(xdgConfig, "bitso")
                } else {
                    Paths.get(home, ".config", "bitso")
                }
            }
        }
    }
}

class CredentialMissingException : RuntimeException(
    "No Bitso API credentials found. Use 'bitso auth set --api-key <key> --api-secret-stdin' to configure."
)

/**
 * Reads the full content of stdin into a ByteArray, then zeroes the intermediate buffer.
 * The secret NEVER becomes a String.
 */
fun readSecretFromStdin(): ByteArray {
    val buffer = ByteArray(4096)
    val out = ByteArrayOutputStream()
    var n: Int
    while (System.`in`.read(buffer).also { n = it } != -1) {
        out.write(buffer, 0, n)
    }
    val result = out.toByteArray()
    java.util.Arrays.fill(buffer, 0.toByte())
    out.reset()
    return result
}

/**
 * Reads the full content of a file path into a ByteArray.
 */
fun readSecretFromFile(path: Path): ByteArray {
    return Files.readAllBytes(path)
}