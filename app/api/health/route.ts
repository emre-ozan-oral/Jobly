import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Unauthenticated reachability + token check for the extension's "Test
 * connection" button. If a bearer token is sent, also reports whether it's
 * a valid personal token - this is the only endpoint that checks a token
 * without requiring it to actually create/update a job.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) return NextResponse.json({ ok: true, tokenValid: null });

  const admin = createAdminClient();
  const { data } = await admin
    .from("api_tokens")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();

  return NextResponse.json({ ok: true, tokenValid: Boolean(data) });
}
