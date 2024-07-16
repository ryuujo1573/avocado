/// <reference types="vitest/globals" />
import { runtime } from "@avocado/core"
import { delay } from "utils/task"
import { hc } from "hono/client"
import { type App } from "./app"
import "data:text/javascript;charset=utf-8;text,console.log('hello world!');"
import { WebSocket } from "ws"

describe("websocket signaling", () => {
  if (runtime.isNodeJS) {
    // @ts-ignore
    globalThis.WebSocket = WebSocket
  }

  it.todo("connect", async () => {
    const urlBase = process.env.urlBase!
    expect(urlBase).toBeTruthy()
    const ws = hc<App>(urlBase)["sync.magic"].$ws()

    let resolve: () => void
    const wsOpenPromise = new Promise<void>(($0) => {
      resolve = $0
    })

    ws.on("open", () => {
      // ws.send(
      //   JSON.stringify({
      //     type: "login",
      //     payload: {
      //       name: "John Doe",
      //       uid: "john_doe",
      //       email: "johndoe@example.com",
      //     },
      //   }),
      // )
      resolve()
    })

    expect(await Promise.race([delay(1000), wsOpenPromise]))
  })
})
