import { getContext } from "@/server/context"
import { listMembers } from "@/server/members"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ org: string }> }
) {
  try {
    const ctx = await getContext((await params).org)
    // 404, not 403: never confirm a company exists to someone outside it.
    if (!ctx) return Response.json({ error: "Not found." }, { status: 404 })
    const result = await listMembers(ctx)
    if (result.ok) return Response.json(result.users)
    return Response.json({ error: result.error }, { status: 403 })
  } catch (error) {
    console.error("list members failed", error)
    return Response.json({ error: "Couldn’t load the team." }, { status: 503 })
  }
}
