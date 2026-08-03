import { config } from "dotenv";

config({ path: process.env.DOTENV_CONFIG_PATH, quiet: true });

export const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
