// src/supabase.js
// ─────────────────────────────────────────────────────────────────────────────
// Which AI, When — Supabase service layer
// Single import point for all DB interaction.
// App.jsx should import from here, not call fetch() directly.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

const BASE_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// ─── Core fetch ──────────────────────────────────────────────────────────────

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...BASE_HEADERS, ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase [${res.status}] ${path}: ${body}`);
  }
  // 204 No Content (e.g. DELETE)
  if (res.status === 204) return null;
  return res.json();
}

// ─── Tools ───────────────────────────────────────────────────────────────────

/**
 * Fetch all tools with all columns.
 * Ordered by name for stable display.
 */
export async function fetchTools() {
  return sbFetch("tools?select=*&order=name");
}

/**
 * Fetch a single tool by id.
 */
export async function fetchTool(id) {
  const rows = await sbFetch(`tools?select=*&id=eq.${id}&limit=1`);
  return rows[0] ?? null;
}

/**
 * Update specific fields on a tool (admin use).
 * @param {string} id — tool slug
 * @param {object} patch — fields to update
 */
export async function updateTool(id, patch) {
  return sbFetch(`tools?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, last_updated: new Date().toISOString().split("T")[0] }),
  });
}

// ─── Categories ──────────────────────────────────────────────────────────────

/**
 * Fetch all categories ordered by sort_order.
 */
export async function fetchCategories() {
  return sbFetch("categories?select=*&order=sort_order");
}

// ─── Tool Categories (scores) ─────────────────────────────────────────────────

/**
 * Fetch all tool × category scores.
 */
export async function fetchToolCategories() {
  return sbFetch("tool_categories?select=*");
}

/**
 * Update score + notes for a specific tool × category pair (admin use).
 */
export async function updateToolCategoryScore(toolId, categoryId, patch) {
  return sbFetch(`tool_categories?tool_id=eq.${toolId}&category_id=eq.${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ─── Composite loader ────────────────────────────────────────────────────────

/**
 * Load everything needed to render the app in one parallel fetch.
 * Returns { tools, categories } in the shape App.jsx already expects.
 *
 * This is the ONLY function App.jsx should call on mount.
 */
export async function loadAppData() {
  const [rawTools, rawCategories, rawToolCats] = await Promise.all([
    fetchTools(),
    fetchCategories(),
    fetchToolCategories(),
  ]);

  return {
    tools:      buildTools(rawTools, rawToolCats),
    categories: buildCategories(rawCategories),
  };
}

// ─── Data builders ───────────────────────────────────────────────────────────

/**
 * Merge tool rows with their category scores into the shape
 * the rest of the app uses: tool.categories[categoryId] = { rank, score, notes }
 */
function buildTools(rawTools, rawToolCats) {
  return rawTools.map(t => {
    const categoryScores = {};
    rawToolCats
      .filter(tc => tc.tool_id === t.id)
      .forEach(tc => {
        categoryScores[tc.category_id] = {
          rank:  tc.rank,
          score: tc.score,
          notes: tc.notes,
        };
      });

    return {
      // IDENTITY · Core
      id:            t.id,
      name:          t.name,
      maker:         t.maker,
      provider:      t.provider,
      modelVersion:  t.model_version,
      avatar:        t.avatar,
      logoUrl:       t.logo_url,
      color:         t.color,
      accent:        t.accent,

      // IDENTITY · Positioning
      tagline:         t.tagline,
      personality:     t.personality,
      primaryStrength: t.primary_strength,
      idealFor:        t.ideal_for,
      notGreatFor:     t.not_great_for,
      traits:          t.traits ?? [],
      bestFor:         t.best_for ?? [],

      // CAPABILITY · Input/Output
      multimodal:       t.multimodal       ?? false,
      fileUpload:       t.file_upload      ?? false,
      imageGeneration:  t.image_generation ?? false,
      voiceMode:        t.voice_mode       ?? false,

      // CAPABILITY · Intelligence
      webSearch:      t.web_search      ?? false,
      codeExecution:  t.code_execution  ?? false,
      reasoningMode:  t.reasoning_mode  ?? false,
      agentic:        t.agentic         ?? false,

      // CAPABILITY · Memory & Context
      memory:        t.memory         ?? false,
      contextWindow: t.context_window ?? null,

      // ACCESS · Interface
      interfaceType: t.interface_type ?? null,
      apiAccess:     t.api_access     ?? false,

      // ACCESS · Commercial
      hasFreeTier:          t.has_free_tier          ?? false,
      pricingTier:          t.pricing_tier           ?? null,
      proPriceUsd:          t.pro_price_usd          ?? null,
      pricingFree:          t.pricing_free           ?? null,  // legacy
      pricingPro:           t.pricing_pro            ?? null,  // legacy
      enterpriseAvailable:  t.enterprise_available   ?? false,

      // PERFORMANCE · Benchmarks
      benchmarks: {
        mmlu:      t.benchmark_mmlu      ?? null,
        humaneval: t.benchmark_humaneval ?? null,
        gsm8k:     t.benchmark_gsm8k     ?? null,
      },
      arenaElo: t.arena_elo ?? null,

      // EDITORIAL
      lastUpdated: t.last_updated ?? null,

      // Scores (from tool_categories join)
      categories: categoryScores,
    };
  });
}

/**
 * Normalise category rows.
 */
function buildCategories(rawCategories) {
  return rawCategories.map(c => ({
    id:          c.id,
    label:       c.label,
    shortLabel:  c.short_label,
    description: c.description,
    sortOrder:   c.sort_order,
  }));
}

// ─── Capability helpers ───────────────────────────────────────────────────────
// Utility functions used by MatrixView, QuizView, etc.
// Centralised here so views don't need to know field names.

/**
 * Returns array of capability flags that are true for a tool.
 * Used for matrix badge display.
 */
export function getCapabilityBadges(tool) {
  const badges = [];
  if (tool.webSearch)      badges.push({ key: "web_search",      label: "Web",      icon: "🌐" });
  if (tool.codeExecution)  badges.push({ key: "code_execution",  label: "Code run", icon: "⚙️" });
  if (tool.imageGeneration)badges.push({ key: "image_gen",       label: "Images",   icon: "🎨" });
  if (tool.multimodal)     badges.push({ key: "multimodal",      label: "Vision",   icon: "👁️" });
  if (tool.voiceMode)      badges.push({ key: "voice",           label: "Voice",    icon: "🎙️" });
  if (tool.memory)         badges.push({ key: "memory",          label: "Memory",   icon: "🧠" });
  if (tool.reasoningMode)  badges.push({ key: "reasoning",       label: "Thinking", icon: "💭" });
  if (tool.agentic)        badges.push({ key: "agentic",         label: "Agentic",  icon: "🤖" });
  if (tool.fileUpload)     badges.push({ key: "files",           label: "Files",    icon: "📄" });
  return badges;
}

/**
 * Returns a pricing display string.
 * Prefers structured fields; falls back to legacy text.
 */
export function getPricingDisplay(tool) {
  if (tool.hasFreeTier && tool.proPriceUsd) {
    return `Free + $${tool.proPriceUsd}/mo`;
  }
  if (tool.hasFreeTier) return "Free";
  if (tool.proPriceUsd) return `$${tool.proPriceUsd}/mo`;
  // legacy fallback
  if (tool.pricingPro)  return tool.pricingPro;
  return "Pricing unknown";
}

/**
 * Format context window for display.
 */
export function formatContextWindow(tokens) {
  if (!tokens) return null;
  if (tokens >= 1_000_000) return `${tokens / 1_000_000}M tokens`;
  if (tokens >= 1_000)     return `${Math.round(tokens / 1000)}K tokens`;
  return `${tokens} tokens`;
}
