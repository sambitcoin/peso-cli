import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parse as parseToml } from 'smol-toml';

export interface Credentials {
  apiKey: string;
  apiSecret: Buffer;
}

function resolveConfigDir(): string {
  const platform = process.platform;
  if (platform === 'win32') {
    const appData = process.env['APPDATA'] ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'bitso');
  }
  const xdgConfig = process.env['XDG_CONFIG_HOME'];
  if (xdgConfig) return path.join(xdgConfig, 'bitso');
  return path.join(os.homedir(), '.config', 'bitso');
}

const CONFIG_DIR = resolveConfigDir();
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.toml');

export class CredentialMissingError extends Error {
  constructor() {
    super("No Bitso API credentials found. Use 'bitso auth set --api-key <key> --api-secret-stdin' to configure.");
  }
}

export function loadCredentials(cliApiKey?: string, cliApiSecret?: Buffer): Credentials {
  if (cliApiKey && cliApiSecret) {
    return { apiKey: cliApiKey, apiSecret: Buffer.from(cliApiSecret) };
  }

  const envKey = process.env['BITSO_API_KEY'];
  const envSecret = process.env['BITSO_API_SECRET'];
  if (envKey && envSecret) {
    return { apiKey: envKey, apiSecret: Buffer.from(envSecret, 'utf8') };
  }

  if (fs.existsSync(CONFIG_FILE)) {
    const creds = parseConfigFile();
    if (creds) return creds;
  }

  throw new CredentialMissingError();
}

function parseConfigFile(): Credentials | null {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = parseToml(content) as Record<string, unknown>;
    const api = parsed['api'] as Record<string, unknown> | undefined;
    if (!api) return null;
    const key = api['key'];
    const secret = api['secret'];
    if (typeof key === 'string' && typeof secret === 'string' && key && secret) {
      return { apiKey: key, apiSecret: Buffer.from(secret, 'utf8') };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCredentials(apiKey: string, apiSecret: Buffer): string {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  try {
    fs.chmodSync(CONFIG_DIR, 0o700);
  } catch {
    // Windows — POSIX permissions not supported
  }

  const body = `[api]\nkey = "${apiKey}"\nsecret = "${apiSecret.toString('utf8')}"`;
  fs.writeFileSync(CONFIG_FILE, body, 'utf8');

  try {
    fs.chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // Windows
  }

  return CONFIG_FILE;
}

export async function readSecretFromStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  const result = Buffer.concat(chunks);
  const last = result[result.length - 1];
  if (last === 0x0a) {
    return Buffer.from(result.subarray(0, result.length - 1));
  }
  return Buffer.from(result);
}

export function readSecretFromFile(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}
