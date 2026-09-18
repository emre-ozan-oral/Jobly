"use client";

import { useRef, useState } from "react";

interface CvProfileClient {
  fileName: string | null;
  skills: string[];
  yearsExperience: number | null;
  targetSeniority: string | null;
  updatedAt: string;
}

const SENIORITY_OPTIONS = [
  "",
  "Intern",
  "Junior",
  "Mid-level",
  "Senior",
  "Staff/Principal",
  "Lead",
];

export default function CvPanel({
  initialProfile,
}: {
  initialProfile: CvProfileClient | null;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [years, setYears] = useState(
    initialProfile?.yearsExperience != null
      ? String(initialProfile.yearsExperience)
      : ""
  );
  const [seniority, setSeniority] = useState(initialProfile?.targetSeniority ?? "");
  const [newSkill, setNewSkill] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a .pdf or .docx file first.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      if (years) form.append("yearsExperience", years);
      if (seniority) form.append("targetSeniority", seniority);
      const res = await fetch("/api/cv", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setProfile(data.profile);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function persistPatch(patch: Record<string, unknown>, optimistic: CvProfileClient) {
    setProfile(optimistic);
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/cv", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setProfile(data.profile);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function removeSkill(skill: string) {
    if (!profile) return;
    const next = profile.skills.filter((s) => s !== skill);
    persistPatch({ skills: next }, { ...profile, skills: next });
  }

  function addSkill() {
    const s = newSkill.trim();
    if (!s || !profile) return;
    if (profile.skills.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
      setNewSkill("");
      return;
    }
    const next = [...profile.skills, s];
    persistPatch({ skills: next }, { ...profile, skills: next });
    setNewSkill("");
  }

  function saveMeta() {
    if (!profile) return;
    persistPatch(
      {
        yearsExperience: years ? Number(years) : null,
        targetSeniority: seniority || null,
      },
      {
        ...profile,
        yearsExperience: years ? Number(years) : null,
        targetSeniority: seniority || null,
      }
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Upload your CV once and the extension will show a match score for
        every job posting - skills it shares with the posting, skills the
        posting wants that aren&apos;t on your CV, and whether the posting&apos;s
        experience requirement fits yours. Everything is matched locally by
        keyword, not by an LLM, so it&apos;s instant.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-zinc-500 dark:text-zinc-400">
            Years of experience
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            placeholder="e.g. 2"
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 dark:text-zinc-400">
            Target seniority
          </label>
          <select
            value={seniority}
            onChange={(e) => setSeniority(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            {SENIORITY_OPTIONS.map((o) => (
              <option key={o || "none"} value={o}>
                {o || "Not set"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx"
          className="text-xs text-zinc-600 file:mr-2 file:rounded-md file:border-0 file:bg-zinc-200 file:px-2.5 file:py-1.5 file:text-xs file:font-medium dark:text-zinc-400 dark:file:bg-zinc-700 dark:file:text-zinc-200"
        />
        <button
          onClick={upload}
          disabled={uploading}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {uploading ? "Uploading..." : profile ? "Replace CV" : "Upload CV"}
        </button>
        {profile && (
          <button
            onClick={saveMeta}
            disabled={saving}
            className="text-xs text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
          >
            {saving ? "Saving..." : savedFlash ? "Saved ✓" : "Save years/seniority"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {profile && (
        <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{profile.fileName || "CV on file"}</span>
            <span>Updated {new Date(profile.updatedAt).toLocaleDateString()}</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Skills detected from your CV. Remove anything wrong, or add
            what the parser missed - these are what the extension matches
            against each posting.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.skills.length === 0 && (
              <span className="text-xs text-zinc-400">
                No skills detected - add some below.
              </span>
            )}
            {profile.skills.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2.5 py-1 text-xs text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
              >
                {s}
                <button
                  onClick={() => removeSkill(s)}
                  className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                  aria-label={`Remove ${s}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Add a skill"
              className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
            />
            <button
              onClick={addSkill}
              className="rounded-md bg-zinc-200 px-2.5 py-1 text-xs text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
