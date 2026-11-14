/** Password rules, shared by the server, the set-password form and the CLI. No imports. */
export const PASSWORD_MIN = 12
/** Upper bound so a huge input can't be used to burn CPU while hashing. */
export const PASSWORD_MAX = 128

/** Returns the problem with a chosen password, or null when acceptable. */
export function passwordProblem(
  password: string,
  email?: string
): string | null {
  if (password.length < PASSWORD_MIN)
    return `Use at least ${PASSWORD_MIN} characters.`
  if (password.length > PASSWORD_MAX)
    return `Use at most ${PASSWORD_MAX} characters.`
  if (!password.trim()) return "A password can’t be only spaces."
  const local = email?.split("@")[0].toLowerCase() ?? ""
  if (local.length >= 4 && password.toLowerCase().includes(local))
    return "Don’t include your email name in your password."
  return null
}
