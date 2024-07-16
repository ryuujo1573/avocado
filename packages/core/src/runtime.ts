// @ts-nocheck

export default runtime
export namespace runtime {
  export const isBrowser = globalThis.window?.document !== undefined

  export const isNodeJS = globalThis.process?.versions?.node !== undefined

  export const isBun = globalThis.process?.versions?.bun !== undefined

  export const isDeno = globalThis.Deno?.version?.deno !== undefined

  export const isElectron = globalThis.process?.versions?.electron !== undefined

  export const isJsDom =
    globalThis.navigator?.userAgent?.includes("jsdom") === true

  export const isWebWorker =
    typeof WorkerGlobalScope !== "undefined" &&
    globalThis instanceof WorkerGlobalScope

  export const isDedicatedWorker =
    typeof DedicatedWorkerGlobalScope !== "undefined" &&
    globalThis instanceof DedicatedWorkerGlobalScope

  export const isSharedWorker =
    typeof SharedWorkerGlobalScope !== "undefined" &&
    globalThis instanceof SharedWorkerGlobalScope

  export const isServiceWorker =
    typeof ServiceWorkerGlobalScope !== "undefined" &&
    globalThis instanceof ServiceWorkerGlobalScope
}
