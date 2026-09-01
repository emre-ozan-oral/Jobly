import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listJobs } from "@/lib/jobs";
import Dashboard from "./components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const jobs = await listJobs(supabase, user.id);
  return (
    <Dashboard initialJobs={jobs} userEmail={user.email ?? ""} userId={user.id} />
  );
}
