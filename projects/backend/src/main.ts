import { runtime } from "@avocado/core";
import { logger } from "@avocado/core/qos";
import { fileURLToPath } from "url";
import { loadEnvFile } from "process";
import app from "./app";
import chalk from "chalk";

let url: URL | undefined;

const isExecuted = fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isExecuted) {
  const t0 = performance.now();
  try {
    loadEnvFile(".env.local");
    loadEnvFile(".env");
  } catch {
    loadEnvFile(".env");
  }
  const args = process.argv.slice(2);

  const hostname = args.includes("--host") ? "0.0.0.0" : "localhost";
  const port = parseInt(process.env.PORT || "3000");
  const isDev = !(process.env.NODE_ENV === "production");

  switch (true) {
    case runtime.isBun: {
      logger.i(`Running on ${chalk.bgWhiteBright.blackBright("Bun")}`);
      const { serve } = await import("bun");
      const { websocket } = await import("./adapter");
      const server = serve({
        fetch: app.fetch,
        websocket,
        hostname,
        port,
      });

      logger.i("Server is listening at:\n\t %o", server.url.origin);
      if (isDev) {
        logger.d("Running in development mode");
      }

      break;
    }
    case runtime.isNodeJS: {
      logger.i(`Running on ${chalk.bgGreenBright.black(" NodeJS ")}`);
      logger.e("websocket currently not supported.");
      const { serve } = await import("@hono/node-server");
      serve({
        fetch: app.fetch,
        hostname,
        port,
      });
      break;
    }
    default: {
      throw "currently not supported environment";
    }
  }
  logger.i("Done. (%o s)", Number((performance.now() - t0).toPrecision(3)));
} else {
  logger.e("Do not import main.ts. \nRun file with TS/JS runtime directly.");
  process.exitCode = 1;
}
