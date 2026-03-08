import { useState, useEffect, useCallback } from "react";

// ─── Supabase config ────────────────────────────────────────────────────────
const SB_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://czxhavedloklkyqhjvpz.supabase.co";
const SB_ANON = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_AxknLEzD-VAetyqpzIU0TQ_zVL-QKmm";

async function sbFetch(path, opts = {}, token = null) {
  const headers = {
    apikey: SB_ANON,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${SB_ANON}` }),
    ...opts.headers,
  };
  const res = await fetch(`${SB_URL}${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── Auth helpers ────────────────────────────────────────────────────────────
async function signIn(email, password) {
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SB_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Login failed");
  return data; // { access_token, user, ... }
}

async function signOut(token) {
  await fetch(`${SB_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
  });
}

// ─── Styles (shared tokens) ──────────────────────────────────────────────────
const S = {
  bg:      "#0d0d1a",
  panel:   "rgba(255,255,255,0.03)",
  border:  "#2d2d4e",
  purple:  "#6C5CE7",
  accent:  "#a78bfa",
  text:    "#e2e8f0",
  muted:   "#64748b",
  dimmed:  "#475569",
  success: "#10B981",
  danger:  "#EF4444",
  warn:    "#F59E0B",
};

const btn = (variant = "default") => ({
  padding: "8px 18px", borderRadius: 10, cursor: "pointer",
  fontSize: 13, fontWeight: 600, border: "1px solid",
  transition: "all 0.15s",
  ...(variant === "primary"   ? { background: S.purple,  borderColor: S.purple,  color: "#fff"    } : {}),
  ...(variant === "default"   ? { background: "transparent", borderColor: S.border, color: S.muted } : {}),
  ...(variant === "danger"    ? { background: "transparent", borderColor: S.danger, color: S.danger } : {}),
  ...(variant === "success"   ? { background: S.success,  borderColor: S.success, color: "#fff"   } : {}),
});

const input = {
  background: "rgba(255,255,255,0.06)", border: `1px solid ${S.border}`,
  borderRadius: 8, padding: "7px 10px", color: S.text, fontSize: 13,
  width: "100%", outline: "none",
};

// ─── Login screen ────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true); setError(null);
    try {
      const session = await signIn(email, password);
      onLogin(session);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: S.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 360, background: S.panel, border: `1px solid ${S.border}`, borderRadius: 18, padding: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.2em", color: S.purple, fontWeight: 600, marginBottom: 6 }}>WHICH AI, WHEN</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: S.text, marginBottom: 24 }}>Admin Panel</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={input} type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          <input style={input} type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          {error && <div style={{ color: S.danger, fontSize: 12 }}>{error}</div>}
          <button style={{ ...btn("primary"), padding: "10px", marginTop: 4 }}
            onClick={handleSubmit} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Scores grid (dynamic — all tools × all categories) ──────────────────────
function ScoresEditor({ tools, categories, token, onSaved }) {
  // grid[tool_id][category_id] = { id, rank, score, notes }
  const [grid, setGrid] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // "tool_id:cat_id"
  const [flash, setFlash] = useState({});     // "tool_id:cat_id" → "ok"|"err"

  useEffect(() => {
    sbFetch("/rest/v1/tool_categories?select=*", {}, token)
      .then(rows => {
        const g = {};
        rows.forEach(r => {
          if (!g[r.tool_id]) g[r.tool_id] = {};
          g[r.tool_id][r.category_id] = { id: r.id, rank: r.rank, score: r.score, notes: r.notes };
        });
        setGrid(g);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const saveCell = useCallback(async (toolId, catId) => {
    const cell = grid[toolId]?.[catId];
    if (!cell) return;
    const key = `${toolId}:${catId}`;
    setSaving(key);
    try {
      await sbFetch(`/rest/v1/tool_categories?id=eq.${cell.id}`, {
        method: "PATCH",
        body: JSON.stringify({ score: Number(cell.score), rank: Number(cell.rank), notes: cell.notes }),
        headers: { Prefer: "return=minimal" },
      }, token);
      try {
        await sbFetch("/rest/v1/rpc/recalculate_ranks", { method: "POST", body: JSON.stringify({}) }, token);
      } catch (rpcErr) {
        console.error("Rank recalculation failed:", rpcErr);
      }
      setFlash(f => ({ ...f, [key]: "ok" }));
      onSaved();
      setTimeout(() => setFlash(f => { const n = { ...f }; delete n[key]; return n; }), 1800);
    } catch (e) {
      setFlash(f => ({ ...f, [key]: "err" }));
      setTimeout(() => setFlash(f => { const n = { ...f }; delete n[key]; return n; }), 3000);
    } finally {
      setSaving(null);
    }
  }, [grid, token, onSaved]);

  const updateCell = (toolId, catId, field, value) => {
    setGrid(g => ({
      ...g,
      [toolId]: { ...g[toolId], [catId]: { ...g[toolId][catId], [field]: value } }
    }));
  };

  if (loading) return <div style={{ color: S.muted, padding: 32, textAlign: "center" }}>Loading scores…</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{ padding: "10px 14px", textAlign: "left", color: S.muted, fontSize: 11, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>
              TOOL
            </th>
            {categories.map(c => (
              <th key={c.id} style={{ padding: "10px 8px", textAlign: "center", color: S.muted, fontSize: 11, fontWeight: 700, borderBottom: `1px solid ${S.border}`, minWidth: 160 }}>
                {c.short_label || c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tools.map((tool, ti) => (
            <tr key={tool.id} style={{ background: ti % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
              <td style={{ padding: "12px 14px", borderBottom: `1px solid ${S.border}`, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 18, marginRight: 8 }}>{tool.avatar}</span>
                <span style={{ fontWeight: 700, color: tool.color || S.text, fontSize: 14 }}>{tool.name}</span>
                {tool.updated_at && (
                  <div style={{ fontSize: 10, color: S.dimmed, marginTop: 2 }}>
                    {new Date(tool.updated_at).toLocaleDateString()}
                  </div>
                )}
              </td>
              {categories.map(c => {
                const cell = grid[tool.id]?.[c.id];
                if (!cell) return <td key={c.id} style={{ padding: 8, borderBottom: `1px solid ${S.border}`, textAlign: "center", color: S.dimmed, fontSize: 12 }}>—</td>;
                const key = `${tool.id}:${c.id}`;
                const isSaving = saving === key;
                const flashState = flash[key];
                return (
                  <td key={c.id} style={{ padding: "8px 6px", borderBottom: `1px solid ${S.border}`, verticalAlign: "top" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <input
                          style={{ ...input, width: 52, textAlign: "center", padding: "5px 6px",
                            borderColor: flashState === "ok" ? S.success : flashState === "err" ? S.danger : S.border }}
                          type="number" min="0" max="100"
                          value={cell.score}
                          onChange={e => updateCell(tool.id, c.id, "score", e.target.value)}
                          onBlur={() => saveCell(tool.id, c.id)}
                          title="Score (0–100)"
                        />
                        <input
                          style={{ ...input, width: 38, textAlign: "center", padding: "5px 4px" }}
                          type="number" min="1"
                          value={cell.rank}
                          onChange={e => updateCell(tool.id, c.id, "rank", e.target.value)}
                          onBlur={() => saveCell(tool.id, c.id)}
                          title="Rank"
                        />
                      </div>
                      <textarea
                        style={{ ...input, fontSize: 11, resize: "vertical", minHeight: 48, padding: "4px 6px", lineHeight: 1.4 }}
                        value={cell.notes}
                        onChange={e => updateCell(tool.id, c.id, "notes", e.target.value)}
                        onBlur={() => saveCell(tool.id, c.id)}
                        placeholder="Notes…"
                      />
                      <div style={{ fontSize: 10, color: flashState === "ok" ? S.success : flashState === "err" ? S.danger : S.dimmed, textAlign: "right", height: 14 }}>
                        {isSaving ? "saving…" : flashState === "ok" ? "✓ saved" : flashState === "err" ? "✗ error" : ""}
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tools editor (per-tool fields) ──────────────────────────────────────────
function ToolsEditor({ tools, setTools, token, onSaved }) {
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(null);
  const [flash, setFlash] = useState({});

  const updateTool = (id, field, value) => {
    setTools(ts => ts.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const saveTool = async (tool) => {
    setSaving(tool.id);
    const payload = {
      name: tool.name, tagline: tool.tagline || null, maker: tool.maker,
      personality: tool.personality, avatar: tool.avatar,
      color: tool.color || null,
      traits: tool.traits, best_for: tool.best_for,
      primary_strength: tool.primary_strength || null,
      ideal_for: tool.ideal_for || null,
      not_great_for: tool.not_great_for || null,
      pricing_tier: tool.pricing_tier || null,
      context_window: tool.context_window === "" ? null : Number(tool.context_window),
      pro_price_usd: tool.pro_price_usd === "" ? null : Number(tool.pro_price_usd),
      arena_elo: tool.arena_elo === "" ? null : Number(tool.arena_elo),
      benchmark_mmlu: tool.benchmark_mmlu === "" ? null : Number(tool.benchmark_mmlu),
      benchmark_humaneval: tool.benchmark_humaneval === "" ? null : Number(tool.benchmark_humaneval),
      benchmark_gsm8k: tool.benchmark_gsm8k === "" ? null : Number(tool.benchmark_gsm8k),
      last_updated: new Date().toISOString(),
    };
    try {
      await sbFetch(`/rest/v1/tools?id=eq.${tool.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
        headers: { Prefer: "return=minimal" },
      }, token);
      setFlash(f => ({ ...f, [tool.id]: "ok" }));
      onSaved();
      setTimeout(() => setFlash(f => { const n = { ...f }; delete n[tool.id]; return n; }), 1800);
    } catch (e) {
      setFlash(f => ({ ...f, [tool.id]: "err" }));
      setTimeout(() => setFlash(f => { const n = { ...f }; delete n[tool.id]; return n; }), 3000);
    } finally {
      setSaving(null);
    }
  };

  const Field = ({ label, toolId, field, type = "text", fullWidth = false }) => {
    const tool = tools.find(t => t.id === toolId);
    const val = tool?.[field] ?? "";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, ...(fullWidth ? { gridColumn: "1 / -1" } : {}) }}>
        <label style={{ fontSize: 10, color: S.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
        {type === "textarea" ? (
          <textarea style={{ ...input, minHeight: 60, resize: "vertical", lineHeight: 1.5 }}
            value={val} onChange={e => updateTool(toolId, field, e.target.value)} />
        ) : type === "checkbox" ? (
          <input type="checkbox" checked={!!val} onChange={e => updateTool(toolId, field, e.target.checked)}
            style={{ width: 18, height: 18, cursor: "pointer", accentColor: S.purple }} />
        ) : (
          <input style={input} type={type} value={val} onChange={e => updateTool(toolId, field, e.target.value)} />
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tools.map(tool => (
        <div key={tool.id} style={{ background: S.panel, border: `1px solid ${expanded === tool.id ? S.purple + "88" : S.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div
            onClick={() => setExpanded(expanded === tool.id ? null : tool.id)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer", borderLeft: `3px solid ${tool.color || S.purple}` }}
          >
            <span style={{ fontSize: 24 }}>{tool.avatar}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: tool.color || S.text, fontSize: 15 }}>{tool.name}</div>
              <div style={{ fontSize: 11, color: S.muted }}>{tool.maker} · {tool.tagline}</div>
            </div>
            <div style={{ fontSize: 10, color: flash[tool.id] === "ok" ? S.success : flash[tool.id] === "err" ? S.danger : S.dimmed }}>
              {saving === tool.id ? "saving…" : flash[tool.id] === "ok" ? "✓ saved" : flash[tool.id] === "err" ? "✗ error" : tool.updated_at ? `updated ${new Date(tool.updated_at).toLocaleDateString()}` : ""}
            </div>
            <div style={{ color: S.dimmed, fontSize: 12 }}>{expanded === tool.id ? "▲" : "▼"}</div>
          </div>
          {expanded === tool.id && (
            <div style={{ padding: "18px 20px", borderTop: `1px solid ${S.border}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Field label="Name" toolId={tool.id} field="name" />
                <Field label="Maker" toolId={tool.id} field="maker" />
                <Field label="Personality" toolId={tool.id} field="personality" />
                <Field label="Avatar (emoji)" toolId={tool.id} field="avatar" />
                <Field label="Tagline" toolId={tool.id} field="tagline" fullWidth />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 10, color: S.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Free tier?</label>
                  <input type="checkbox" checked={!!tool.pricing_free}
                    onChange={e => updateTool(tool.id, "pricing_free", e.target.checked)}
                    style={{ width: 18, height: 18, cursor: "pointer", accentColor: S.purple }} />
                </div>
                <Field label="Pro pricing" toolId={tool.id} field="pricing_pro" />
              </div>
              <div style={{ fontSize: 11, color: S.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Benchmarks</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                <Field label="MMLU %" toolId={tool.id} field="benchmark_mmlu" type="number" />
                <Field label="HumanEval %" toolId={tool.id} field="benchmark_humaneval" type="number" />
                <Field label="GSM8K %" toolId={tool.id} field="benchmark_gsm8k" type="number" />
                <Field label="Arena Elo" toolId={tool.id} field="arena_elo" type="number" />
              </div>
              <div style={{ fontSize: 11, color: S.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Positioning & Pricing</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Field label="Primary Strength" toolId={tool.id} field="primary_strength" type="textarea" fullWidth />
                <Field label="Ideal For" toolId={tool.id} field="ideal_for" type="textarea" />
                <Field label="Not Great For" toolId={tool.id} field="not_great_for" type="textarea" />
                <Field label="Context window (tokens)" toolId={tool.id} field="context_window" type="number" />
                <Field label="Pricing tier" toolId={tool.id} field="pricing_tier" />
                <Field label="Pro price USD" toolId={tool.id} field="pro_price_usd" type="number" />
                <Field label="Brand color (hex)" toolId={tool.id} field="color" />
              </div>
              <div style={{ fontSize: 11, color: S.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Traits (comma-separated)</div>
              <input style={{ ...input, marginBottom: 12 }}
                value={Array.isArray(tool.traits) ? tool.traits.join(", ") : tool.traits || ""}
                onChange={e => updateTool(tool.id, "traits", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              />
              <div style={{ fontSize: 11, color: S.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Best for (category IDs, comma-separated)</div>
              <input style={{ ...input, marginBottom: 16 }}
                value={Array.isArray(tool.best_for) ? tool.best_for.join(", ") : tool.best_for || ""}
                onChange={e => updateTool(tool.id, "best_for", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              />
              <button style={btn("primary")} onClick={() => saveTool(tool)}>
                {saving === tool.id ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main admin dashboard ─────────────────────────────────────────────────────
export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("scores");
  const [tools, setTools] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const loadData = useCallback(async (token) => {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([
        sbFetch("/rest/v1/tools?select=*&order=id", {}, token),
        sbFetch("/rest/v1/categories?select=*&order=sort_order", {}, token),
      ]);
      setTools(t);
      setCategories(c);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = useCallback(async (sess) => {
    setSession(sess);
    await loadData(sess.access_token);
  }, [loadData]);

  const handleLogout = async () => {
    if (session) await signOut(session.access_token).catch(() => {});
    setSession(null);
    setTools([]);
    setCategories([]);
  };

  const handleSaved = useCallback(() => {
    setLastSaved(new Date());
  }, []);

  if (!session) return <LoginScreen onLogin={handleLogin} />;

  const TABS = [
    { id: "scores", label: `Scores grid (${tools.length}×${categories.length})` },
    { id: "tools",  label: `Tools (${tools.length})` },
  ];

  return (
    <div style={{ minHeight: "100vh", background: S.bg, color: S.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0d0d1a,#1a1035,#0d0d1a)", borderBottom: `1px solid ${S.border}`, padding: "18px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", color: S.purple, fontWeight: 600 }}>WHICH AI, WHEN</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: S.text }}>Admin Panel</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastSaved && (
            <div style={{ fontSize: 11, color: S.success }}>
              Last saved {lastSaved.toLocaleTimeString()}
            </div>
          )}
          <div style={{ fontSize: 12, color: S.muted }}>{session.user?.email}</div>
          <button style={btn("default")} onClick={handleLogout}>Sign out</button>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 6, padding: "16px 24px 0", borderBottom: `1px solid ${S.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 16px", borderRadius: "10px 10px 0 0",
            border: `1px solid ${tab === t.id ? S.border : "transparent"}`,
            borderBottom: tab === t.id ? `1px solid ${S.bg}` : "none",
            background: tab === t.id ? S.bg : "transparent",
            color: tab === t.id ? S.accent : S.muted,
            cursor: "pointer", fontSize: 13, fontWeight: 600,
            marginBottom: tab === t.id ? -1 : 0,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: S.muted }}>Loading data…</div>
        ) : tab === "scores" ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: S.muted }}>
                Edit scores, ranks, and notes. Changes save automatically on blur.
                <span style={{ color: S.dimmed, marginLeft: 8 }}>Score: 0–100 · Rank: position within category</span>
              </div>
            </div>
            <ScoresEditor tools={tools} categories={categories} token={session.access_token} onSaved={handleSaved} />
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: S.muted }}>Edit tool metadata. Click Save on each tool after making changes.</div>
            </div>
            <ToolsEditor tools={tools} setTools={setTools} token={session.access_token} onSaved={handleSaved} />
          </>
        )}
      </div>
    </div>
  );
}
