import { getContext } from "@/server/context"
import { exportDashboard } from "@/server/domain"

/** Download everything the caller can see in this company, as JSON. Recorded in the audit log. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ org: string }> }
) {
  const { org } = await params
  const ctx = await getContext(org)
  if (!ctx) return Response.json({ error: "Not found." }, { status: 404 })
  try {
    const data = await exportDashboard(ctx)
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${org}-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("export failed", error)
    return Response.json({ error: "Couldn’t export right now." }, { status: 503 })
  }
}
