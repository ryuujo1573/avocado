import { runtime } from "@avocado/core"
import type { UpgradeWebSocket } from "hono/ws"
import { createBunWebSocket } from "hono/bun"

let upgradeWebSocket: UpgradeWebSocket
let websocket: ReturnType<typeof createBunWebSocket>["websocket"] | undefined

switch (true) {
  case runtime.isBun: {
    const { createBunWebSocket } = await import("hono/bun")

    const { upgradeWebSocket: $0, websocket: $1 } = createBunWebSocket()
    upgradeWebSocket = $0
    websocket = $1
    break
  }
  case runtime.isDeno: {
    const { upgradeWebSocket: $0 } = await import("hono/deno")
    upgradeWebSocket = $0
    break
  }
  default: {
    upgradeWebSocket = (create) => async (c, next) => {
      // todo: shim for nodejs
      return await next()
    }
  }
}

export { upgradeWebSocket, websocket }
