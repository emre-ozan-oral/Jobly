import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Unauthenticated reachability + token check for the extension's "Test
 * connection" button. If a bearer token is sent, reports whether it's
 * valid - either a Supabase session token (the extension's sign-in flow)
 * or a personal API token - without requiring it to actually create or
 * update a job.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) return NextResponse.json({ ok: true, tokenValid: null });

  const admin = createAdminClient();

  const { data: jwtUser } = await admin.auth.getUser(token);
  if (jwtUser?.user) {
    return NextResponse.json({ ok: true, tokenValid: true });
  }

  const { data } = await admin
    .from("api_tokens")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();

  return NextResponse.json({ ok: true, tokenValid: Boolean(data) });
}
