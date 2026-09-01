import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJob, findByUrl, updateJob } from "@/lib/jobs";
import { sourceFromUrl } from "@/lib/parse";

/**
 * Used by the Jobly browser extension. Two ways to authenticate, both as a
 * bearer credential:
 *  - A Supabase session access token, from the extension's sign-in flow
 *    (/api/auth/signin) - this is what the extension uses now.
 *  - A personal API token (from the dashboard's Settings page) - kept for
 *    backward compatibility and for anyone scripting against this endpoint
 *    directly without wanting to store a password-derived session.
 * Either way we need the service-role client: resolving a token to a
 * user_id (or validating a JWT belongs to a real user) has to read across
 * all users, and every subsequent query is explicitly scoped to that
 * resolved user_id.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let userId: string | null = null;

  // Try it as a Supabase session token first (the extension's sign-in flow).
  const { data: jwtUser } = await admin.auth.getUser(token);
  if (jwtUser?.user) {
    userId = jwtUser.user.id;
  } else {
    // Fall back to a personal API token.
    const { data: tokenRow } = await admin
      .from("api_tokens")
      .select("user_id")
      .eq("token", token)
      .maybeSingle();
    if (tokenRow) userId = tokenRow.user_id as string;
  }

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
