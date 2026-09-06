const { spawnSync } = require('node:child_process');
const { existsSync, readdirSync } = require('node:fs');
const path = require('node:path');
const env = {
  ...process.env,
  FIREBASE_EMULATORS_PATH: path.resolve('node_modules/.tmp/firebase-emulators'),
  npm_config_cache: path.resolve('node_modules/.tmp/npm-cache'),
};
// Windows commonly exposes "Path", rather than "PATH", in a copied env object.
const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') ?? 'PATH';
env[pathKey] = path.dirname(process.execPath) + path.delimiter + (env[pathKey] ?? '');
// Prefer a project-local portable runtime when present; otherwise use Java 21+ on PATH.
const runtime = path.resolve('node_modules/.tmp/java-test/runtime');
if (existsSync(runtime)) {
  const directory = readdirSync(runtime).find(name => existsSync(path.join(runtime, name, 'bin', 'java.exe')));
  if (directory) env[pathKey] = path.join(runtime, directory, 'bin') + path.delimiter + env[pathKey];
}
const cli = path.resolve('node_modules/firebase-tools/lib/bin/firebase.js');
const args = ['emulators:exec', '--only', 'firestore', '--project', 'demo-punkture-tests', 'node --test tests/firestore.rules.mjs'];
let command;
if (existsSync(cli)) command = [cli, ...args];
else if (process.env.npm_execpath) command = [process.env.npm_execpath, 'exec', '--yes', '--package=firebase-tools@15.29.0', '--', 'firebase', ...args];
else { console.error('Run this check with npm run test:rules.'); process.exit(1); }
const result = spawnSync(process.execPath, command, { env, stdio: 'inherit', windowsHide: true });
process.exit(result.status ?? 1);
