// Create an account from the terminal. Used once for the platform SUPER_ADMIN, or to
// bootstrap a customer's first OWNER. Everyone else is invited from the Users page.
//
//   pnpm user:create --email you@company.com --name "Your Name"            (SUPER_ADMIN)
//   pnpm user:create --email owner@client.com --name "Their Name" --role OWNER
//
// Prompts for the password (hidden). For automation, set CREATE_USER_PASSWORD instead.
import readline from "node:readline"
import { parseArgs } from "node:util"

import { hashPassword } from "../lib/auth/password.ts"
import { passwordProblem } from "../lib/auth/password-rules.ts"
import { ROLE_LABELS, ROLES } from "../lib/auth/roles.ts"

import pg from "pg"

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "SUPER_ADMIN" },
  },
})
const email = values.email?.trim().toLowerCase()
const name = values.name?.trim()
const role = values.role?.toUpperCase()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  fail("Pass --email with a valid address.")
if (!name) fail('Pass --name "Full Name".')
if (!ROLES.includes(role)) fail(`--role must be one of: ${ROLES.join(", ")}.`)

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
if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set (.env).")

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()
try {
  await client.query("begin")
  const {
    rows: [user],
  } = await client.query(
    `insert into users (email, name, password_hash, role, status, password_changed_at)
     values ($1, $2, $3, $4, 'active', now()) returning id`,
    [email, name, await hashPassword(password), role]
  )
  await client.query(
    `insert into audit_logs (action, outcome, entity_type, entity_id, changes, meta)
     values ('user.created', 'success', 'user', $1, $2, '{"via":"cli"}')`,
    [user.id, JSON.stringify({ role: [null, role] })]
  )
  await client.query("commit")
  console.log(
    `✓ ${ROLE_LABELS[role]} account created for ${email}. Sign in at /login.`
  )
} catch (error) {
  await client.query("rollback").catch(() => {})
  if (error.constraint === "users_one_super_admin")
    fail("A SUPER_ADMIN already exists. There can only be one.")
  if (error.constraint === "users_email_unique")
    fail("An account with this email already exists.")
  if (error.code === "42P01")
    fail("Tables don’t exist yet. Run pnpm db:migrate first.")
  fail(error.message)
} finally {
  client.release()
  await pool.end()
}
