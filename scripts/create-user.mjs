// Create a Pentest Scout Super Admin from the terminal. This is the only way to get one: the app
// can't grant platform_role (trigger users_protect_platform_role). Companies sign themselves up
// and invite their own people.
//
//   pnpm user:create --email you@pentestscout.com --name "Your Name"
//
// Prompts for the password (hidden). For automation, set CREATE_USER_PASSWORD instead.
import readline from "node:readline"
import { parseArgs } from "node:util"

import { hashPassword } from "../lib/auth/password.ts"
import { passwordProblem } from "../lib/auth/password-rules.ts"

import pg from "pg"

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
  },
})
const email = values.email?.trim().toLowerCase()
const name = values.name?.trim()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  fail("Pass --email with a valid address.")
if (!name) fail('Pass --name "Full Name".')

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    })
    // Echo the prompt, swallow the typed characters.
    rl._writeToOutput = (text) => {
      if (text.includes(question)) rl.output.write(question)
    }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write("\n")
      resolve(answer)
    })
  })
}

let password = process.env.CREATE_USER_PASSWORD
if (!password) {
  if (!process.stdin.isTTY)
    fail("No terminal to prompt in. Set CREATE_USER_PASSWORD instead.")
  password = await ask("Password: ")
  if ((await ask("Repeat password: ")) !== password)
    fail("Passwords don’t match.")
}
const problem = passwordProblem(password, email)
if (problem) fail(problem)

try {
  process.loadEnvFile(".env")
} catch {}
// Granting platform_role needs the table owner, not the app's restricted role.
const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) fail("MIGRATION_DATABASE_URL (or DATABASE_URL) is not set (.env).")

const pool = new pg.Pool({ connectionString: url })
const client = await pool.connect()
try {
  await client.query("begin")
  // Lets the platform_role trigger accept this insert, for this transaction only.
  await client.query("select set_config('app.cli', 'on', true)")
  const {
    rows: [user],
  } = await client.query(
    `insert into users (email, name, password_hash, platform_role, status, email_verified_at, password_changed_at)
     values ($1, $2, $3, 'SUPER_ADMIN', 'active', now(), now()) returning id`,
    [email, name, await hashPassword(password)]
  )
  await client.query(
    `insert into audit_logs (action, outcome, actor_platform, entity_type, entity_id, changes, meta)
     values ('user.created', 'success', true, 'user', $1, $2, '{"via":"cli"}')`,
    [user.id, JSON.stringify({ platform_role: [null, "SUPER_ADMIN"] })]
  )
  await client.query("commit")
  console.log(`✓ Super Admin account created for ${email}. Sign in at /login.`)
} catch (error) {
  await client.query("rollback").catch(() => {})
  if (error.constraint === "users_email_unique")
    fail("An account with this email already exists.")
  if (error.code === "42P01")
    fail("Tables don’t exist yet. Run pnpm db:migrate first.")
  fail(error.message)
} finally {
  client.release()
  await pool.end()
}
