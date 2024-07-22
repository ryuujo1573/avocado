/**
 * @fileoverview Main entry point for the agent.
 */
import "./hoc";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { loadEnvFile } from "process";

export async function main() {
  loadEnvFile(".env");

  return 0;
}

const isExecuted = import.meta.url
  .let(fileURLToPath)
  .let(resolve)
  .includes(process.argv[1]);

if (isExecuted) {
  await main();
}
