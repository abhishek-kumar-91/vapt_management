/**
 * Password hashing with Node's built-in scrypt (OWASP profile: N=2^15, r=8, p=3, ~32 MiB).
 * Stored as `scrypt$<log2N>$<r>$<p>$<salt>$<hash>` so parameters can be raised later
 * without breaking existing hashes. Node-only, no "server-only": the CLI imports it too.
 */
import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto"

const LOG_N = 15
const R = 8
const P = 3
const KEY_LEN = 32

function scrypt(password: string, salt: Buffer, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, KEY_LEN, opts, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  )
}

const params = (logN: number, r: number, p: number): ScryptOptions => ({
  N: 2 ** logN,
  r,
  p,
  maxmem: 256 * 2 ** logN * r,
})

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, params(LOG_N, R, P))
  return [
    "scrypt",
    LOG_N,
    R,
    P,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$")
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [algo, logN, r, p, salt, hash] = stored.split("$")
  if (algo !== "scrypt" || !hash) return false
  const expected = Buffer.from(hash, "base64url")
  const key = await scrypt(
    password,
    Buffer.from(salt, "base64url"),
    params(Number(logN), Number(r), Number(p))
  )
  return key.length === expected.length && timingSafeEqual(key, expected)
}

let decoy: Promise<string> | undefined
/**
 * A real hash of a random password. Checked when the email is unknown or the account
 * has no password, so every failed sign-in costs the same time.
 */
export function decoyHash() {
  return (decoy ??= hashPassword(randomBytes(32).toString("base64url")))
}
