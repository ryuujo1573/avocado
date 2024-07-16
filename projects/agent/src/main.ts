/**
 * @fileoverview Main entry point for the agent.
 */
import "./hoc";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { debugSocketInfo } from "@avocado/netstat-lib";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { cwd } from "process";

export async function main() {
  console.log("Environment: \n\t[cwd]: %o", cwd());

  const envVars = config({
    path: ".env.local",
  }).let(expand);
  console.log(envVars);

  debugSocketInfo();

  return 0;
}

const isExecuted = import.meta.url
  .let(fileURLToPath)
  .let(resolve)
  .includes(process.argv[1]);

if (isExecuted) {
  await main();
}
