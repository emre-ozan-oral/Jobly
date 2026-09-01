"use client";

import { useState } from "react";

export default function TokenPanel({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function rotate() {
    if (
      !confirm(
        "This invalidates the current token - the extension will stop working until you paste the new one into its Options page. Continue?"
      )
    )
      return;
    setRotating(true);
    try {
      const res = await fetch("/api/tokens", { method: "POST" });
      const data = await res.json();
      if (data.token) setToken(data.token);
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-zinc-100 px-3 py-2 text-xs">
          {token}
        </code>
        <button
          onClick={copy}
          className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <button
        onClick={rotate}
        disabled={rotating}
        className="text-xs text-zinc-500 hover:text-red-600 disabled:opacity-50"
      >
        {rotating ? "Rotating..." : "Regenerate token"}
      </button>
    </div>
  );
}
