import runtime from "./runtime"

const badgeLike =
  "padding: .2em 1ch; border-radius: 2px; font-size: 0.8em; font-weight: bold;"
export class QoS {
  #enabled = true
  readonly #logFormat: string
  readonly #logFormatExt: string[]

  constructor() {
    switch (true) {
      case runtime.isWebWorker:
        this.#logFormat = "%cAvocado Worker%c %s"
        this.#logFormatExt = [
          "background: #3cc; color: #fff; " + badgeLike,
          "color: inherit",
        ]
        break
      case runtime.isServiceWorker:
        this.#logFormat = "%cAvocado ServiceWorker%c %s"
        this.#logFormatExt = [
          "background: #e33; color: #fff; " + badgeLike,
          "color: inherit;",
        ]
        break
      case runtime.isElectron:
      case runtime.isBrowser:
        // case runtime.isJsDom:
        this.#logFormat = "%cAvocado%c %s"
        this.#logFormatExt = [
          "background: #e52; color: #fff; " + badgeLike,
          "color: inherit;",
        ]
        break
      case runtime.isNodeJS:
        this.#logFormat = "\x1b[36m[Avocado]\x1b[0m %s"
        this.#logFormatExt = []
        break
      default:
        this.#logFormat = "[Avocado] %s"
        this.#logFormatExt = []
        break
    }
    // return new Proxy(this, {})
  }

  set enabled(v: boolean) {
    this.#enabled = v
    console.debug(`QoS ${v ? "en" : "dis"}abled`)
  }

  get enabled() {
    return this.#enabled
  }

  #logWrap(write: typeof console.log, args: unknown[]) {
    const escape = "%"
    const logFormat = this.#logFormat
    const logReplace = this.#logFormatExt
    if (typeof args[0] == "string" && args[0].includes(escape)) {
      const msg = args.shift() as string
      write(logFormat.replace("%s", msg), ...logReplace, ...args)
    } else {
      write(logFormat, ...args)
    }
  }

  d(...args: unknown[]) {
    this.#logWrap(console.debug, args)
  }

  w(...args: unknown[]) {
    this.#logWrap(console.warn, args)
  }

  e(...args: unknown[]) {
    this.#logWrap(console.error, args)
  }

  i(...args: unknown[]) {
    this.#logWrap(console.info, args)
  }

  trace(...args: unknown[]) {
    this.#logWrap(console.trace, args)
  }
}

export const logger = new QoS()
logger.d("QoS initialized")
