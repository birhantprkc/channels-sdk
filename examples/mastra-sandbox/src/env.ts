import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (existsSync(resolve(".env"))) {
  process.loadEnvFile(resolve(".env"));
}

export function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
