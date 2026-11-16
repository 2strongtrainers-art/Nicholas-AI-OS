#!/usr/bin/env node
// Copy only this service's GitHub environment secrets to its already deployed Worker.
// Wrangler receives the JSON through stdin; no secret file or raw CLI output is emitted.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validContactId } from '../src/policy.mjs';

export const SECRET_NAMES = ['CLIENT_TOKEN', 'CONTROL_TOKEN', 'OPENAI_API_KEY', 'CONTACTS_JSON'];
export const WORKER_NAME = 'nk-personal-text-assistant';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = resolve(ROOT, 'wrangler.jsonc');
const WRANGLER = resolve(ROOT, 'node_modules/wrangler/bin/wrangler.js');
const VERSION = '4.163.0';

export function validatedSecrets(env) {
  const secrets = Object.fromEntries(SECRET_NAMES.map(name => [name, env[name]]));
  if (SECRET_NAMES.some(name => typeof secrets[name] !== 'string' || !secrets[name].trim()))
    throw new Error('runtime_secret_missing');
  for (const name of ['CLIENT_TOKEN', 'CONTROL_TOKEN']) {
    if (!/^[\x21-\x7e]{32,512}$/.test(secrets[name])) throw new Error('application_token_invalid');
  }
  if (secrets.CLIENT_TOKEN === secrets.CONTROL_TOKEN) throw new Error('application_tokens_must_differ');
  if (!/^[\x21-\x7e]{1,4096}$/.test(secrets.OPENAI_API_KEY)) throw new Error('provider_key_invalid');
  let contacts;
  try {
    contacts = JSON.parse(secrets.CONTACTS_JSON);
  } catch {
    throw new Error('contacts_configuration_invalid');
  }
  if (!contacts || typeof contacts !== 'object' || Array.isArray(contacts))
    throw new Error('contacts_configuration_invalid');
  for (const [id, contact] of Object.entries(contacts)) {
    if (!validContactId(id) || !contact || typeof contact !== 'object' || Array.isArray(contact)
        || Object.keys(contact).some(key => !['enabled', 'consent', 'auto'].includes(key))
        || typeof contact.enabled !== 'boolean' || typeof contact.consent !== 'boolean'
        || ('auto' in contact && typeof contact.auto !== 'boolean'))
      throw new Error('contacts_configuration_invalid');
  }
  // {} is the safe initial configuration; values remain strings for Wrangler bulk.
  secrets.CONTACTS_JSON = JSON.stringify(contacts);
  return secrets;
}

export function wranglerEnvironment(env) {
  const allowed = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'SYSTEMROOT', 'WINDIR',
    'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy',
    'all_proxy', 'no_proxy', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
    'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
  const result = Object.fromEntries(allowed.filter(key => typeof env[key] === 'string').map(key => [key, env[key]]));
  return { ...result, CI: 'true', WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false',
    WRANGLER_LOG_SANITIZE: 'true', WRANGLER_LOG: 'log', NO_COLOR: '1' };
}

export function runWrangler(args, env, input, spawn = spawnSync) {
  try {
    const result = spawn(process.execPath, [WRANGLER, ...args, '--config', CONFIG, '--name', WORKER_NAME], {
      cwd: ROOT, env: wranglerEnvironment(env), input, encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], timeout: 90_000, maxBuffer: 1_048_576,
    });
    if (result.error || result.status !== 0) throw new Error('wrangler_command_failed');
    return result.stdout;
  } catch {
    // Never reflect stderr, HTTP errors, serialized inputs or thrown transport text.
    throw new Error('wrangler_command_failed');
  }
}

function secretNames(output) {
  try {
    const entries = JSON.parse(output);
    if (!Array.isArray(entries) || entries.some(entry => !entry || typeof entry.name !== 'string'
      || entry.type !== 'secret_text')) throw new Error();
    return new Set(entries.map(entry => entry.name));
  } catch {
    throw new Error('worker_secret_list_unverified');
  }
}

export function installSecrets(env, spawn = spawnSync) {
  const secrets = validatedSecrets(env);
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID)
    throw new Error('cloudflare_configuration_missing');
  // secret list fails for an absent Worker. Do not invoke bulk as a creation fallback.
  secretNames(runWrangler(['secret', 'list', '--format', 'json'], env, undefined, spawn));
  runWrangler(['secret', 'bulk'], env, JSON.stringify(secrets) + '\n', spawn);
  const installed = secretNames(runWrangler(['secret', 'list', '--format', 'json'], env, undefined, spawn));
  if (SECRET_NAMES.some(name => !installed.has(name))) throw new Error('runtime_secret_names_unverified');
}

export function main(mode, env = process.env, output = console) {
  try {
    if (!['--check', '--install'].includes(mode)) throw new Error('invalid_mode');
    const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
    if (config.name !== WORKER_NAME) throw new Error('unexpected_worker_target');
    validatedSecrets(env);
    if (mode === '--install') {
      const pkg = JSON.parse(readFileSync(resolve(ROOT, 'node_modules/wrangler/package.json'), 'utf8'));
      if (pkg.version !== VERSION) throw new Error('unexpected_wrangler_version');
      installSecrets(env);
    }
    output.log(mode === '--check' ? 'Personal text runtime secret preflight passed.'
      : 'Four personal text runtime secret names verified; activation flags were not changed.');
    return 0;
  } catch {
    // Fixed messages also cover file/JSON errors without leaking their contents.
    output.error(mode === '--check' ? 'Personal text runtime secret preflight failed.'
      : 'Personal text runtime secret installation failed. No secret values were logged.');
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = main(process.argv[2]);
