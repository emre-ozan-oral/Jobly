import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * Refreshes the extension's stored session once its access token is close
 * to expiring (Supabase access tokens last ~1 hour). The extension calls
 * this automatically before a capture request rather than asking the user
 * to sign in again.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.refreshToken) {
    return NextResponse.json(
      { error: "refreshToken is required" },
      { status: 400 }
    );
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: body.refreshToken,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message || "session expired, please sign in again" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    email: data.user?.email,
  });
}
