import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCvProfile } from "@/lib/cv";
import CvPanel from "./CvPanel";

export const dynamic = "force-dynamic";

export default async function CvPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cvProfile = (await getCvProfile(supabase, user.id)) ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← Back
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">My CV</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Upload once - the extension uses this to show a match score on
        every job posting you look at.
      </p>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <CvPanel initialProfile={cvProfile} />
      </div>
    </div>
  );
}
