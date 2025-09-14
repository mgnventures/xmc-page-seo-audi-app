"use client";

import { useEffect, useState, useCallback } from "react";
import { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { useMarketplaceClient } from "@/utils/useMarketplaceClient";
import { runSeoA11yAudit, type AuditResult } from "@/utils/audit";

function isBareOrigin(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    // Disallow any path other than "/" and any search/hash
    if ((u.pathname && u.pathname !== "/") || u.search || u.hash) return false;
    return true;
  } catch {
    return false;
  }
}

function absoluteUrlFromRoute(baseOrigin: string, route: string): string {
  const base = baseOrigin.replace(/\/$/, "");
  const path = route.startsWith("/") ? route : `/${route}`;
  return `${base}${path}`;
}

async function proxyFetch(url: string): Promise<string> {
  const proxied = new URL("/api/preview-proxy", location.origin);
  proxied.searchParams.set("url", url);
  const res = await fetch(proxied.toString(), { credentials: "omit" });
  if (!res.ok) throw new Error(`Proxy ${res.status}`);
  return await res.text();
}

export default function RouteAuditorPanel() {
  const { client, ready, error } = useMarketplaceClient();
  const [auditedUrl, setAuditedUrl] = useState<string>("");
  const [results, setResults] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Base URL state with localStorage persistence
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [baseUrlError, setBaseUrlError] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("sc_auditor_baseurl") || "";
    setBaseUrl(saved);
  }, []);
  useEffect(() => {
    if (baseUrl) localStorage.setItem("sc_auditor_baseurl", baseUrl);
  }, [baseUrl]);

  const getPagesContext = useCallback(async (c: ClientSDK) => {
    const res = await c.query("pages.context");
    return res.data as { pageInfo: { route: string; displayName?: string } };
  }, []);

  const run = useCallback(async () => {
    if (!client) return;

    // Validate base URL
    if (!baseUrl || !isBareOrigin(baseUrl)) {
      setBaseUrlError("Enter a valid site base URL (e.g., https://example.com) without any path or query.");
      return;
    }
    setBaseUrlError("");

    setLoading(true);
    try {
      const ctx = await getPagesContext(client);
      const url = absoluteUrlFromRoute(baseUrl, ctx.pageInfo.route || "/");
      setAuditedUrl(url);

      const html = await proxyFetch(url);
      const found = runSeoA11yAudit(html);
      setResults(found);
    } catch (e) {
      console.error(e);
      setResults([{ id: "fetch-failed", severity: "error", message: "Could not fetch page HTML. Verify base URL and proxy allowlist." }]);
    } finally {
      setLoading(false);
    }
  }, [client, getPagesContext, baseUrl]);

  useEffect(() => {
    if (ready && client && baseUrl && isBareOrigin(baseUrl)) run();
  }, [ready, client]); // user can click run manually after setting baseUrl

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">SEO &amp; A11y — Route Auditor</h2>

      {/* Base URL input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Site Base URL</label>
        <div className="flex gap-2">
          <input
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${baseUrlError ? "border-red-400" : "border-gray-300"}`}
            placeholder="https://www.your-site.com"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value.trim())}
          />
          <button
            className="px-3 py-2 rounded-lg border text-sm"
            onClick={run}
            disabled={loading}
            title="Run audit"
          >
            {loading ? "Scanning…" : "Run audit"}
          </button>
        </div>
        {baseUrlError && <div className="text-xs text-red-600">{baseUrlError}</div>}
        <div className="text-xs opacity-70">
          Must start with http/https and be a bare domain (no path, query, or hash).
        </div>
      </div>

      {error && <div className="text-red-700">Init error: {String(error)}</div>}

      {auditedUrl && (
        <div className="text-xs break-all opacity-70">
          Auditing URL: <code>{auditedUrl}</code>
        </div>
      )}

      {/* Findings */}
      <div className="border rounded-xl p-3">
        <div className="font-medium mb-2">Findings ({results.length})</div>
        <ul className="space-y-2 text-sm">
          {results.map((r) => {
            const color =
              r.severity === "success"
                ? "text-green-700 border-green-200 bg-green-50"
                : r.severity === "warning"
                ? "text-amber-700 border-amber-200 bg-amber-50"
                : "text-red-700 border-red-200 bg-red-50";

            const icon =
              r.severity === "success" ? "✅" : r.severity === "warning" ? "⚠️" : "❌";
            const label =
              r.severity === "success" ? "Pass" : r.severity === "warning" ? "Warning" : "Error";

            return (
              <li key={r.id} className={`border rounded-lg ${color}`}>
                <details className="px-3 py-2">
                  <summary className="flex items-start gap-2 cursor-pointer">
                    <span className="shrink-0">{icon}</span>
                    <div>
                      <div className="font-semibold">{label}</div>
                      <div>{r.message}</div>
                    </div>
                  </summary>

                  <div className="mt-2 pl-6 space-y-2">
                    {r.selector && (
                      <div className="text-xs opacity-70">
                        Selector: <code>{r.selector}</code>
                      </div>
                    )}
                    {(r.line || r.column) && (
                      <div className="text-xs opacity-70">
                        Location: {r.line ? `line ${r.line}` : ""}{r.line && r.column ? ", " : ""}{r.column ? `col ${r.column}` : ""}
                      </div>
                    )}
                    {r.snippet && (
                      <pre className="text-xs p-2 rounded bg-white/70 overflow-x-auto border">
{r.snippet}
                      </pre>
                    )}
                    {r.recommendation && (
                      <div className="text-xs">
                        <span className="font-medium">Suggested fix: </span>{r.recommendation}
                      </div>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
