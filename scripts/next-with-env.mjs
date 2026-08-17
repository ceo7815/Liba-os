import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PLACEHOLDER = /placeholder/i;
const ROOT = process.cwd();

function loadEnvFile(fileName, target) {
  const full = resolve(ROOT, fileName);
  if (!existsSync(full)) return;
  const text = readFileSync(full, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    target[key] = value;
  }
}

const env = { ...process.env };

// Drop bad inherited overrides from earlier build commands
for (const key of Object.keys(env)) {
  if (PLACEHOLDER.test(String(env[key] ?? ""))) {
    delete env[key];
  }
}

loadEnvFile(".env", env);
loadEnvFile(".env.local", env);

const args = process.argv.slice(2);
const child = spawn("npx", ["next", ...args], {
  stdio: "inherit",
  env,
  shell: true,
  cwd: ROOT,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
