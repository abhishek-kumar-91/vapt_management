import { listUsers } from "@/lib/auth/users"

export async function GET() {
  try {
    const result = await listUsers()
    if (result.ok) return Response.json(result.users)
    const status = result.error.startsWith("Your session ended") ? 401 : 403
    return Response.json({ error: result.error }, { status })
  } catch (error) {
    console.error("list users failed", error)
    return Response.json({ error: "Couldn’t load users." }, { status: 503 })
  }
}
