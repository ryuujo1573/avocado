import "vite/client"
declare global {
  /**
   * @throws {SyntaxError} `VERSION` is statically replaced by the package version at build time.
   */
  const VERSION: string
}
