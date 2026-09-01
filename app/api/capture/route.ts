import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJob, findByUrl, updateJob } from "@/lib/jobs";
import { sourceFromUrl } from "@/lib/parse";

/**
 * Used by the Jobly browser extension. The extension has no login UI of
 * its own - it authenticates with a personal API token (from the
 * dashboard's Settings page) sent as a bearer credential, which we look up
 * here to find which user it belongs to. That lookup needs the
 * service-role client since it has to read across all users' tokens;
 * every subsequent query is explicitly scoped to the resolved user_id.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: tokenRow, error: tokenError } = await admin
    .from("api_tokens")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = tokenRow.user_id as string;

  const body = await req.json().catch(() => null);
  if (!body || !body.url || !body.title) {
    return NextResponse.json(
      { error: "url and title are required" },
      { status: 400 }
    );
  }

  const existing = await findByUrl(admin, userId, body.url);
  if (existing) {
    const job = await updateJob(admin, userId, existing.id, {
      company: body.company || existing.company,
      title: body.title || existing.title,
      location: body.location ?? existing.location,
      salary: body.salary ?? existing.salary,
    });
    return NextResponse.json({ job, deduped: true });
  }

  const job = await createJob(admin, userId, {
    company: body.company || "Unknown",
    title: body.title,
    url: body.url,
    source: body.source || sourceFromUrl(body.url),
    location: body.location,
    salary: body.salary,
    appliedDate: body.appliedDate,
    status: body.status || "applied",
  });

  return NextResponse.json({ job }, { status: 201 });
}
