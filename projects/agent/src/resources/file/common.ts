export function getHomePath() {
  return process.env.HOME || process.env.USERPROFILE || ""
}
