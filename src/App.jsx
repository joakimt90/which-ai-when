import { useState, useEffect, useCallback } from "react";
import { Radar, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement,
  Filler, Tooltip as ChartTooltip, Legend, CategoryScale, LinearScale, BarElement
} from 'chart.js';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler,
  ChartTooltip, Legend, CategoryScale, LinearScale, BarElement);

// ─── RESPONSIVE HOOK ──────────────────────────────────────────────────────────
function useBreakpoint() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return { isMobile: width < 640, isTablet: width < 900, width };
}

// ─── DATA ─────────────────────────────────────────────────────────────────────
const tools = [
  {
    id: "claude", name: "Claude", maker: "Anthropic",
    color: "#D4845A", accent: "#F2C49B",
    personality: "The Thoughtful Architect",
    tagline: "Deep reasoning, careful nuance, minimal hallucination",
    avatar: "🧠", traits: ["Nuanced", "Structured", "Reflective", "Honest"],
    pricing: { free: true, pro: "$20/mo" }, bestFor: ["discuss", "write"],
    categories: {
      discuss: { rank: 1, score: 97, notes: "Best back-and-forth dialogue. Highly efficient token use. Strong at holding context, pushing back intelligently, and refining ideas iteratively." },
      build:   { rank: 2, score: 85, notes: "Claude Code + Projects make it a strong build partner. Excels at architecture planning and complex multi-file reasoning." },
      analyse: { rank: 2, score: 88, notes: "Exceptional at synthesising complex material, comparing frameworks, and producing structured analysis." },
      write:   { rank: 1, score: 96, notes: "Best long-form quality. Strong voice consistency, nuanced tone-matching, and editing ability." },
      create:  { rank: 3, score: 72, notes: "Can ideate well but lacks native image gen. Artifact feature useful for interactive mockups." },
    },
    benchmarks: { mmlu: 88.7, humaneval: 79.6, gsm8k: 92.0 }, arenaElo: 1250,
  },
  {
    id: "gpt", name: "ChatGPT", maker: "OpenAI",
    color: "#10A37F", accent: "#6EE7C7",
    personality: "The Swiss Army Knife",
    tagline: "Broadest plugin ecosystem, reliable generalist powerhouse",
    avatar: "⚙️", traits: ["Versatile", "Plugged-in", "Fast", "Broad"],
    pricing: { free: true, pro: "$20/mo" }, bestFor: ["build", "create"],
    categories: {
      discuss: { rank: 2, score: 88, notes: "Solid conversational quality. GPT-4o is fast and fluid. Memory feature helps continuity. Can be verbose — watch token drain on quick chats." },
      build:   { rank: 1, score: 94, notes: "Best ecosystem for build workflows: Code Interpreter, Zapier, browsing, DALL·E, custom GPTs. Advanced Data Analysis is unmatched." },
      analyse: { rank: 1, score: 92, notes: "Live web browsing + Python execution = powerful research combo. Best for real-time data and market research." },
      write:   { rank: 2, score: 87, notes: "Reliable, clean output. Custom Instructions help tailor tone. Slightly less literary depth than Claude but very production-ready." },
      create:  { rank: 1, score: 95, notes: "DALL·E 3 integration + Sora access + GPT-4o image understanding. Best all-round creative suite for multimodal work." },
    },
    benchmarks: { mmlu: 88.7, humaneval: 85.4, gsm8k: 92.0 }, arenaElo: 1200,
  },
  {
    id: "gemini", name: "Gemini", maker: "Google",
    color: "#4285F4", accent: "#A8C7FA",
    personality: "The Research Librarian",
    tagline: "Google-native search fusion, massive context window",
    avatar: "🔍", traits: ["Connected", "Contextual", "Grounded", "Thorough"],
    pricing: { free: true, pro: "$19.99/mo" }, bestFor: ["analyse"],
    categories: {
      discuss: { rank: 4, score: 74, notes: "Improving but less fluid in back-and-forth. Deep Research mode is slow for quick planning. Better for structured Q&A." },
      build:   { rank: 3, score: 80, notes: "Strong in Google Workspace automation. Gemini in Colab is excellent for data science." },
      analyse: { rank: 3, score: 90, notes: "2M token context window is a game-changer for document analysis. Gemini Deep Research produces thorough, cited reports." },
      write:   { rank: 3, score: 82, notes: "Good structured writing, especially for factual/research-backed content. Less creative flair than Claude." },
      create:  { rank: 2, score: 88, notes: "Imagen 3 produces excellent photorealistic outputs. Strong multimodal understanding across video, audio, and images." },
    },
    benchmarks: { mmlu: 90.0, humaneval: 84.0, gsm8k: 94.4 }, arenaElo: 1230,
  },
  {
    id: "grok", name: "Grok", maker: "xAI",
    color: "#E7363D", accent: "#F9A8AB",
    personality: "The Real-Time Contrarian",
    tagline: "X/Twitter-native, edgy, unfiltered live-data access",
    avatar: "⚡", traits: ["Current", "Bold", "Unfiltered", "Social"],
    pricing: { free: false, pro: "X Premium (~$8–16/mo)" }, bestFor: [],
    categories: {
      discuss: { rank: 3, score: 78, notes: "Witty and direct. Good for pressure-testing ideas. Less structured than Claude for long planning." },
      build:   { rank: 4, score: 68, notes: "Grok 3 shows real coding ability but ecosystem lags. Best for quick scripts and X/social automations." },
      analyse: { rank: 4, score: 80, notes: "Unique edge: real-time X/Twitter data. Best for social intelligence and trending topics. Weaker on deep academic research." },
      write:   { rank: 4, score: 75, notes: "Good for punchy, opinionated content and social copy. Less suited to formal long-form writing." },
      create:  { rank: 4, score: 70, notes: "Aurora image gen improving but trails DALL·E 3 and Imagen 3. Strong for social-native visuals." },
    },
    benchmarks: { mmlu: 87.0, humaneval: 73.0, gsm8k: 88.0 }, arenaElo: 1180,
  },
  {
    id: "perplexity", name: "Perplexity", maker: "Perplexity AI",
    color: "#6C5CE7", accent: "#C4B8FF",
    personality: "The Fact-Checker",
    tagline: "Search-first AI — every answer cited and sourced",
    avatar: "📎", traits: ["Cited", "Precise", "Current", "Honest"],
    pricing: { free: true, pro: "$20/mo" }, bestFor: ["analyse"],
    categories: {
      discuss: { rank: 5, score: 65, notes: "Not designed for dialogue. Better as a lookup tool than a thinking partner." },
      build:   { rank: 5, score: 50, notes: "Not a build tool. Code help is basic. No agent or automation features." },
      analyse: { rank: 2, score: 91, notes: "Best pure research tool. Every claim is cited, sources ranked, answers current. Ideal for due diligence and fact verification." },
      write:   { rank: 5, score: 62, notes: "Useful as a research backbone for writing but output is functional, not polished." },
      create:  { rank: 5, score: 40, notes: "No creative or image generation features." },
    },
    benchmarks: { mmlu: null, humaneval: null, gsm8k: null }, arenaElo: null,
  },
  {
    id: "cursor", name: "Cursor", maker: "Anysphere",
    color: "#F7B731", accent: "#FDE68A",
    personality: "The Code Specialist",
    tagline: "IDE-embedded AI — build faster inside your actual codebase",
    avatar: "💻", traits: ["Precise", "In-context", "Fast", "Automated"],
    pricing: { free: true, pro: "$20/mo" }, bestFor: ["build"],
    categories: {
      discuss: { rank: 6, score: 45, notes: "Not designed for open discussion. Poor for strategy or ideation outside dev tasks." },
      build:   { rank: 1, score: 98, notes: "Best build tool bar none. Multi-file edits, full repo context, terminal automation. Cursor Agent autonomously plans and implements complex features." },
      analyse: { rank: 6, score: 55, notes: "Good at code-level analysis: bugs, architecture, PR reviews. Poor at broader research." },
      write:   { rank: 6, score: 40, notes: "Not a writing tool." },
      create:  { rank: 6, score: 30, notes: "UI mockup generation improving but not its purpose." },
    },
    benchmarks: { mmlu: null, humaneval: null, gsm8k: null }, arenaElo: null,
  },
];

const CATEGORIES = [
  { id: "discuss", label: "💬 Discuss & Plan",      shortLabel: "Discuss",  description: "Back-and-forth dialogue, ideation, strategy — token efficiency and conversational depth matter most." },
  { id: "build",   label: "🔨 Build & Execute",      shortLabel: "Build",    description: "App development, automation, agentic tasks — tooling, code quality, and process orchestration." },
  { id: "analyse", label: "🔬 Understand & Analyse", shortLabel: "Analyse",  description: "Web research, information harvesting, concept comparison — sourcing and analytical depth." },
  { id: "write",   label: "✍️ Write & Communicate",  shortLabel: "Write",    description: "Long-form content, documents, editing, voice-matching — prose quality and structure." },
  { id: "create",  label: "🎨 Create & Visualise",   shortLabel: "Create",   description: "Image generation, multimodal creativity, visual ideation — generative output quality." },
];

const BENCHMARKS_META = [
  { id: "mmlu",      label: "MMLU",      description: "Multi-task language understanding across 57 subjects (% correct)." },
  { id: "humaneval", label: "HumanEval", description: "Coding ability — % of programming problems solved correctly." },
  { id: "gsm8k",     label: "GSM8K",     description: "Grade school math reasoning (% correct)." },
];

const MEDALS = ["🥇", "🥈", "🥉", "4th", "5th", "6th"];
const MEDAL_COLORS = ["#F59E0B", "#9CA3AF", "#CD7C3C", "#6B7280", "#6B7280", "#6B7280"];

// ─── QUIZ ─────────────────────────────────────────────────────────────────────
const QUIZ = [
  { id: "primary_use", question: "What do you use AI for most?", emoji: "🎯", options: [
    { label: "Planning & thinking out loud", value: "discuss" },
    { label: "Building apps or automating",  value: "build"   },
    { label: "Research & fact-checking",     value: "analyse" },
    { label: "Writing & editing",            value: "write"   },
    { label: "Creative & visual work",       value: "create"  },
  ]},
  { id: "secondary_use", question: "What's your second most common use?", emoji: "🔁", options: [
    { label: "Planning & thinking out loud", value: "discuss" },
    { label: "Building apps or automating",  value: "build"   },
    { label: "Research & fact-checking",     value: "analyse" },
    { label: "Writing & editing",            value: "write"   },
    { label: "Creative & visual work",       value: "create"  },
  ]},
  { id: "session_style", question: "How do you typically work with AI?", emoji: "💬", options: [
    { label: "Long back-and-forth sessions",  value: "conversational" },
    { label: "Quick one-shot tasks",          value: "oneshot"        },
    { label: "Deep research dives",           value: "research"       },
    { label: "Hands-off automation / agents", value: "agentic"        },
  ]},
  { id: "budget", question: "What's your budget?", emoji: "💰", options: [
    { label: "Free only",          value: "free"      },
    { label: "Up to $20/month",    value: "mid"       },
    { label: "Whatever it takes",  value: "unlimited" },
  ]},
  { id: "tech_comfort", question: "How technical are you?", emoji: "🛠️", options: [
    { label: "Non-technical — I just need it to work", value: "low"  },
    { label: "Comfortable but not a developer",        value: "mid"  },
    { label: "Developer or power user",                value: "high" },
  ]},
];

function scoreToolsFromAnswers(answers) {
  return tools.map(tool => {
    let score = 0;
    const cats = tool.categories;
    if (answers.primary_use) score += (cats[answers.primary_use]?.score || 0) * 2.5;
    if (answers.secondary_use && answers.secondary_use !== answers.primary_use)
      score += (cats[answers.secondary_use]?.score || 0) * 1.2;
    if (answers.session_style === "conversational") score += (cats.discuss?.score || 0) * 0.8;
    if (answers.session_style === "oneshot")        score += tool.id === "perplexity" ? 40 : 0;
    if (answers.session_style === "research")       score += (cats.analyse?.score || 0) * 0.6;
    if (answers.session_style === "agentic")        score += (cats.build?.score || 0) * 0.7;
    if (answers.budget === "free" && !tool.pricing.free) score -= 150;
    if (answers.tech_comfort === "high" && tool.id === "cursor") score += 60;
    if (answers.tech_comfort === "low"  && tool.id === "cursor") score -= 80;
    if (answers.tech_comfort === "low"  && tool.id === "gpt")    score += 20;
    return { ...tool, quizScore: Math.max(0, Math.round(score)) };
  }).sort((a, b) => b.quizScore - a.quizScore);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)].join(",");
}

function ScoreBar({ score, color }) {
  return (
    <div style={{ background: "#1a1a2e", borderRadius: 4, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${score}%`, height: "100%", background: color ? `linear-gradient(90deg,${color}99,${color})` : "linear-gradient(90deg,#6C5CE7,#a78bfa)", borderRadius: 4, transition: "width 0.6s ease" }} />
    </div>
  );
}

function radarChartData(selectedToolList) {
  return {
    labels: CATEGORIES.map(c => c.shortLabel),
    datasets: selectedToolList.map(tool => ({
      label: tool.name,
      data: CATEGORIES.map(c => tool.categories[c.id]?.score || 0),
      backgroundColor: `${tool.color}33`,
      borderColor: tool.color,
      borderWidth: 2,
      pointBackgroundColor: tool.color,
    })),
  };
}

// ─── QUIZ VIEWS ───────────────────────────────────────────────────────────────
function QuizView({ onComplete, isMobile }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const q = QUIZ[step];
  const progress = (step / QUIZ.length) * 100;

  const handleAnswer = (value) => {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (step < QUIZ.length - 1) setStep(step + 1);
    else onComplete(scoreToolsFromAnswers(next));
  };

  return (
    <div style={{ padding: isMobile ? "24px 16px" : "32px 24px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: "#475569" }}>
          <span>Question {step + 1} of {QUIZ.length}</span><span>{Math.round(progress)}%</span>
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 4, height: 4 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#6C5CE7,#a78bfa)", borderRadius: 4, transition: "width 0.4s ease" }} />
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>{q.emoji}</div>
        <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{q.question}</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.options.map(opt => (
          <button key={opt.value} onClick={() => handleAnswer(opt.value)} style={{
            padding: isMobile ? "12px 16px" : "14px 20px", borderRadius: 12,
            border: "1px solid #2d2d4e", background: "rgba(255,255,255,0.04)",
            color: "#e2e8f0", cursor: "pointer", fontSize: isMobile ? 14 : 15,
            fontWeight: 500, textAlign: "left", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#6C5CE7"; e.currentTarget.style.background = "rgba(108,92,231,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#2d2d4e"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          >{opt.label}</button>
        ))}
      </div>
      {step > 0 && <button onClick={() => setStep(step - 1)} style={{ marginTop: 16, background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 13 }}>← Back</button>}
    </div>
  );
}

function QuizResult({ results, onRetake, onGoToTool, isMobile }) {
  const top = results[0];
  const rest = results.slice(1, 4);
  return (
    <div style={{ padding: isMobile ? "24px 16px" : "32px 24px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#6C5CE7", marginBottom: 8, fontWeight: 600 }}>Your Best Match</div>
        <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 4px" }}>Start with {top.name}</h2>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{top.tagline}</p>
      </div>
      <div onClick={() => onGoToTool(top.id)} style={{
        background: `linear-gradient(135deg,rgba(${hexToRgb(top.color)},0.15) 0%,rgba(13,13,26,0.9) 60%)`,
        border: `1px solid ${top.color}55`, borderRadius: 18, padding: isMobile ? 18 : 24, marginBottom: 16, cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <span style={{ fontSize: isMobile ? 32 : 40 }}>{top.avatar}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: isMobile ? 18 : 22, color: "#f1f5f9" }}>{top.name}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{top.personality}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 900, color: top.color }}>{top.quizScore}</div>
            <div style={{ fontSize: 10, color: "#475569" }}>match score</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {top.traits.map(t => <span key={t} style={{ padding: "3px 10px", borderRadius: 20, background: `${top.color}22`, border: `1px solid ${top.color}44`, color: top.accent, fontSize: 11, fontWeight: 600 }}>{t}</span>)}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Also consider</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {rest.map(tool => (
          <div key={tool.id} onClick={() => onGoToTool(tool.id)} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid #2d2d4e", borderRadius: 12, padding: "12px 16px", cursor: "pointer" }}>
            <span style={{ fontSize: 20 }}>{tool.avatar}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>{tool.name}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{tool.personality}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: tool.color }}>{tool.quizScore}</div>
          </div>
        ))}
      </div>
      <button onClick={onRetake} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid #2d2d4e", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>↺ Retake Quiz</button>
    </div>
  );
}

// ─── RANKED VIEW ──────────────────────────────────────────────────────────────
function RankedView({ activeCategory, isMobile }) {
  const [expandedTool, setExpandedTool] = useState(null);
  const ranked = [...tools].filter(t => t.categories[activeCategory]).sort((a, b) => a.categories[activeCategory].rank - b.categories[activeCategory].rank);
  return (
    <div style={{ padding: isMobile ? "16px 12px 0" : "20px 24px 0", maxWidth: 760, margin: "0 auto" }}>
      {ranked.map((tool, i) => {
        const catData = tool.categories[activeCategory];
        const isExpanded = expandedTool === tool.id;
        return (
          <div key={tool.id} onClick={() => setExpandedTool(isExpanded ? null : tool.id)} style={{
            background: isExpanded ? `linear-gradient(135deg,rgba(${hexToRgb(tool.color)},0.12) 0%,rgba(13,13,26,1) 60%)` : "rgba(255,255,255,0.03)",
            border: `1px solid ${isExpanded ? tool.color + "55" : "#2d2d4e"}`, borderRadius: 16,
            padding: isMobile ? "14px 12px" : "18px 20px", marginBottom: 10, cursor: "pointer",
            transition: "all 0.25s", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: tool.color, borderRadius: "16px 0 0 16px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, paddingLeft: isMobile ? 6 : 8 }}>
              <div style={{ fontSize: isMobile ? 16 : 20, minWidth: 30, textAlign: "center", color: MEDAL_COLORS[i], fontWeight: 800 }}>{MEDALS[i]}</div>
              <div style={{ width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: 10, background: `linear-gradient(135deg,${tool.color}33,${tool.color}22)`, border: `1px solid ${tool.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 18 : 22, flexShrink: 0 }}>{tool.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: isMobile ? 15 : 17, color: "#f1f5f9" }}>{tool.name}</span>
                  {!isMobile && <span style={{ fontSize: 11, color: "#475569" }}>{tool.maker}</span>}
                  {tool.bestFor.includes(activeCategory) && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, background: `${tool.color}33`, color: tool.accent, fontWeight: 700 }}>★ BEST</span>}
                </div>
                <div style={{ fontSize: isMobile ? 11 : 12, color: "#64748b", marginTop: 2 }}>{tool.personality}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: tool.color, lineHeight: 1 }}>{catData.score}</div>
                <div style={{ fontSize: 10, color: "#475569" }}>/ 100</div>
              </div>
              <div style={{ color: "#475569", fontSize: 12 }}>{isExpanded ? "▲" : "▼"}</div>
            </div>
            <div style={{ paddingLeft: isMobile ? 6 : 8, marginTop: 10 }}><ScoreBar score={catData.score} color={tool.color} /></div>
            {isExpanded && (
              <div style={{ paddingLeft: isMobile ? 6 : 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid #2d2d4e" }}>
                <p style={{ color: "#94a3b8", fontSize: isMobile ? 13 : 14, lineHeight: 1.7, margin: "0 0 12px" }}>{catData.notes}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {tool.traits.map(t => <span key={t} style={{ padding: "4px 10px", borderRadius: 20, background: `${tool.color}22`, border: `1px solid ${tool.color}44`, color: tool.accent, fontSize: 11, fontWeight: 600 }}>{t}</span>)}
                </div>
                <div style={{ padding: "8px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, display: "inline-flex", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>💰 {tool.pricing.free ? `Free + ${tool.pricing.pro}` : tool.pricing.pro}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>💡 {tool.tagline}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MATRIX VIEW ─────────────────────────────────────────────────────────────
function MatrixView({ isMobile }) {
  const [expandedTool, setExpandedTool] = useState(null);

  if (isMobile) {
    return (
      <div style={{ padding: "16px 12px 0" }}>
        {tools.map(tool => (
          <div key={tool.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #2d2d4e", borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
            <div onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px", cursor: "pointer", borderLeft: `3px solid ${tool.color}` }}>
              <span style={{ fontSize: 22 }}>{tool.avatar}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>{tool.name}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{tool.personality}</div>
              </div>
              <div style={{ color: "#475569", fontSize: 12 }}>{expandedTool === tool.id ? "▲" : "▼"}</div>
            </div>
            {expandedTool === tool.id && (
              <div style={{ padding: "12px 14px", borderTop: "1px solid #2d2d4e" }}>
                {CATEGORIES.map(c => {
                  const d = tool.categories[c.id];
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, minWidth: 72, color: "#64748b" }}>{c.shortLabel}</span>
                      <ScoreBar score={d.score} color={d.rank === 1 ? tool.color : undefined} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: d.rank === 1 ? tool.color : "#94a3b8", minWidth: 28, textAlign: "right" }}>{d.score}</span>
                      <span style={{ fontSize: 13 }}>{MEDALS[d.rank - 1]}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", overflowX: "auto" }}>
      <div style={{ minWidth: 660 }}>
        <div style={{ display: "grid", gridTemplateColumns: "170px repeat(5,1fr)", gap: 8, marginBottom: 8 }}>
          <div />
          {CATEGORIES.map(c => (
            <div key={c.id} style={{ textAlign: "center", fontSize: 11, color: "#64748b", fontWeight: 600, lineHeight: 1.4, padding: "4px 2px" }}>{c.label}</div>
          ))}
        </div>
        {tools.map(tool => (
          <div key={tool.id} style={{ display: "grid", gridTemplateColumns: "170px repeat(5,1fr)", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", border: "1px solid #2d2d4e" }}>
              <span style={{ fontSize: 18 }}>{tool.avatar}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{tool.name}</div>
                <div style={{ fontSize: 10, color: "#475569" }}>{tool.maker}</div>
              </div>
            </div>
            {CATEGORIES.map(c => {
              const d = tool.categories[c.id];
              return (
                <div key={c.id} style={{
                  background: d.rank === 1 ? `${tool.color}30` : d.rank === 2 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                  border: d.rank === 1 ? `1px solid ${tool.color}66` : "1px solid #2d2d4e",
                  borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px",
                }}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{MEDALS[d.rank - 1]}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: d.rank === 1 ? tool.color : "#94a3b8" }}>{d.score}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPARE VIEW ─────────────────────────────────────────────────────────────
function CompareView({ isMobile }) {
  const [selectedIds, setSelectedIds] = useState(["claude", "gpt"]);
  const toggle = (id) => setSelectedIds(prev => prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id]);
  const selected = tools.filter(t => selectedIds.includes(t.id));

  const barData = {
    labels: CATEGORIES.map(c => c.shortLabel),
    datasets: selected.map(t => ({
      label: t.name, data: CATEGORIES.map(c => t.categories[c.id]?.score || 0),
      backgroundColor: t.color + "99", borderColor: t.color, borderWidth: 2, borderRadius: 4,
    })),
  };

  const sharedChartConfig = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#e2e8f0", padding: 16 } }, tooltip: { backgroundColor: "#1a1a2e", titleColor: "#f1f5f9", bodyColor: "#94a3b8" } },
    animation: { duration: 500 },
  };

  const barOptions = {
    ...sharedChartConfig,
    scales: {
      y: { beginAtZero: false, min: 30, max: 100, grid: { color: "#1e2a3a" }, ticks: { color: "#64748b" } },
      x: { grid: { color: "#1e2a3a" }, ticks: { color: "#94a3b8", font: { size: isMobile ? 10 : 12 } } },
    },
  };

  const radarOptions = {
    ...sharedChartConfig,
    scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, color: "#475569" }, grid: { color: "#2d2d4e" }, angleLines: { color: "#2d2d4e" }, pointLabels: { color: "#94a3b8", font: { size: isMobile ? 10 : 12 } } } },
    plugins: { ...sharedChartConfig.plugins, legend: { ...sharedChartConfig.plugins.legend, position: "bottom" } },
  };

  return (
    <div style={{ padding: isMobile ? "16px 12px 0" : "20px 24px 0", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Select tools to compare</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tools.map(t => (
            <button key={t.id} onClick={() => toggle(t.id)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "7px 12px" : "8px 16px",
              borderRadius: 20, border: `1px solid ${selectedIds.includes(t.id) ? t.color : "#2d2d4e"}`,
              background: selectedIds.includes(t.id) ? `${t.color}22` : "transparent",
              color: selectedIds.includes(t.id) ? t.accent : "#64748b",
              cursor: "pointer", fontSize: isMobile ? 12 : 13, fontWeight: 600, transition: "all 0.15s",
            }}><span>{t.avatar}</span>{t.name}</button>
          ))}
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#94a3b8", marginBottom: 16, letterSpacing: "0.05em" }}>CATEGORY SCORES</div>
        <div style={{ height: isMobile ? 220 : 300 }}><Bar data={barData} options={barOptions} /></div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#94a3b8", marginBottom: 16, letterSpacing: "0.05em" }}>RADAR OVERLAY</div>
        <div style={{ maxWidth: 480, margin: "0 auto", height: isMobile ? 260 : 380 }}>
          <Radar data={radarChartData(selected)} options={radarOptions} />
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 20 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#94a3b8", marginBottom: 16, letterSpacing: "0.05em" }}>HEAD-TO-HEAD</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 12 : 13 }}>
            <thead>
              <tr>
                <td style={{ padding: "8px 12px", color: "#475569", fontWeight: 600, borderBottom: "1px solid #2d2d4e" }}>Category</td>
                {selected.map(t => <td key={t.id} style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #2d2d4e", color: t.color, fontWeight: 700 }}>{t.avatar} {t.name}</td>)}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(c => {
                const scores = selected.map(t => t.categories[c.id]?.score || 0);
                const maxScore = Math.max(...scores);
                return (
                  <tr key={c.id}>
                    <td style={{ padding: "10px 12px", color: "#64748b", borderBottom: "1px solid #1a1a2e" }}>{c.label}</td>
                    {selected.map(t => {
                      const score = t.categories[c.id]?.score || 0;
                      const isWinner = score === maxScore;
                      return <td key={t.id} style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #1a1a2e", fontWeight: isWinner ? 800 : 500, color: isWinner ? t.color : "#64748b", fontSize: isWinner ? 15 : 13 }}>{isWinner ? "★ " : ""}{score}</td>;
                    })}
                  </tr>
                );
              })}
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                <td style={{ padding: "10px 12px", color: "#94a3b8", fontWeight: 700 }}>Overall avg</td>
                {selected.map(t => {
                  const avg = Math.round(Object.values(t.categories).reduce((s, c) => s + c.score, 0) / Object.values(t.categories).length);
                  return <td key={t.id} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, color: t.color, fontSize: 16 }}>{avg}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── RADAR VIEW ───────────────────────────────────────────────────────────────
function RadarView({ selectedTools: sel, onToggleTool, isMobile }) {
  const selected = tools.filter(t => sel.includes(t.id));
  const radarOptions = {
    scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, color: "#94a3b8" }, grid: { color: "#2d2d4e" }, angleLines: { color: "#2d2d4e" }, pointLabels: { color: "#e2e8f0", font: { size: isMobile ? 10 : 12 } } } },
    plugins: { legend: { display: true, position: "bottom", labels: { color: "#e2e8f0", padding: 16 } } },
    animation: { duration: 600 },
  };
  return (
    <div style={{ padding: isMobile ? "16px 12px 0" : "24px", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, marginBottom: 16 }}>Select tools to overlay on the radar</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
        {tools.map(t => (
          <button key={t.id} onClick={() => onToggleTool(t.id)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "7px 12px" : "8px 14px", borderRadius: 20,
            border: `1px solid ${sel.includes(t.id) ? t.color : "#2d2d4e"}`,
            background: sel.includes(t.id) ? `${t.color}22` : "transparent",
            color: sel.includes(t.id) ? t.accent : "#64748b",
            cursor: "pointer", fontSize: isMobile ? 12 : 13, fontWeight: 600, transition: "all 0.2s",
          }}><span>{t.avatar}</span>{t.name}</button>
        ))}
      </div>
      {selected.length > 0 ? (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 24 }}>
          <div style={{ maxWidth: 500, margin: "0 auto", height: isMobile ? 280 : 420 }}>
            <Radar data={radarChartData(selected)} options={radarOptions} />
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🕸️</div>
          <div style={{ color: "#374151", fontSize: 14 }}>Select at least one tool above</div>
        </div>
      )}
    </div>
  );
}

// ─── BENCHMARKS VIEW ─────────────────────────────────────────────────────────
function BenchmarksView({ selectedTools: sel, onToggleTool, isMobile }) {
  const selected = tools.filter(t => sel.includes(t.id));

  const percentData = {
    labels: BENCHMARKS_META.map(b => b.label),
    datasets: selected.map(t => ({ label: t.name, data: BENCHMARKS_META.map(b => t.benchmarks[b.id] ?? null), backgroundColor: t.color + "88", borderColor: t.color, borderWidth: 1 })),
  };
  const eloData = {
    labels: ["Arena Elo"],
    datasets: selected.map(t => ({ label: t.name, data: [t.arenaElo ?? null], backgroundColor: t.color + "88", borderColor: t.color, borderWidth: 1 })),
  };

  const baseOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#e2e8f0" } }, tooltip: { backgroundColor: "#1a1a2e", bodyColor: "#94a3b8", titleColor: "#f1f5f9" } }, animation: { duration: 500 } };
  const pOpts = { ...baseOpts, scales: { y: { beginAtZero: false, min: 60, max: 100, grid: { color: "#1e2a3a" }, ticks: { color: "#64748b" } }, x: { grid: { color: "#1e2a3a" }, ticks: { color: "#94a3b8" } } } };
  const eOpts = { ...baseOpts, scales: { y: { beginAtZero: false, min: 1100, grid: { color: "#1e2a3a" }, ticks: { color: "#64748b" } }, x: { grid: { color: "#1e2a3a" }, ticks: { color: "#94a3b8" } } } };

  return (
    <div style={{ padding: isMobile ? "16px 12px 0" : "24px", maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
        {tools.map(t => (
          <button key={t.id} onClick={() => onToggleTool(t.id)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "7px 12px" : "8px 14px", borderRadius: 20,
            border: `1px solid ${sel.includes(t.id) ? t.color : "#2d2d4e"}`,
            background: sel.includes(t.id) ? `${t.color}22` : "transparent",
            color: sel.includes(t.id) ? t.accent : "#64748b",
            cursor: "pointer", fontSize: isMobile ? 12 : 13, fontWeight: 600, transition: "all 0.2s",
          }}><span>{t.avatar}</span>{t.name}</button>
        ))}
      </div>
      {selected.length > 0 ? (
        <>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9", marginBottom: 4 }}>Knowledge & Coding Benchmarks</div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 16 }}>MMLU / HumanEval / GSM8K — all % correct. Null = not publicly tested.</div>
            <div style={{ height: isMobile ? 200 : 280 }}><Bar data={percentData} options={pOpts} /></div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9", marginBottom: 4 }}>Chatbot Arena — Human Preference (Elo)</div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 16 }}>Blind head-to-head votes. Scale ~1100–1350. Higher = more preferred.</div>
            <div style={{ height: isMobile ? 180 : 240 }}><Bar data={eloData} options={eOpts} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 10 }}>
            {BENCHMARKS_META.map(b => (
              <div key={b.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px", border: "1px solid #2d2d4e" }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa", marginBottom: 4 }}>{b.label}</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{b.description}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
          <div style={{ color: "#374151", fontSize: 14 }}>Select at least one tool above</div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: "quiz",       label: "❓ Quiz"       },
  { id: "ranked",     label: "📊 Ranked"     },
  { id: "compare",    label: "⚖️ Compare"    },
  { id: "matrix",     label: "🔲 Matrix"     },
  { id: "radar",      label: "🕸️ Radar"      },
  { id: "benchmarks", label: "🏆 Benchmarks" },
];

export default function AIGuide() {
  const { isMobile } = useBreakpoint();
  const [view, setView] = useState("quiz");
  const [activeCategory, setActiveCategory] = useState("discuss");
  const [selectedTools, setSelectedTools] = useState([]);
  const [quizResults, setQuizResults] = useState(null);

  const showCategoryTabs = view === "ranked" || view === "matrix";
  const cat = CATEGORIES.find(c => c.id === activeCategory);

  const toggleTool = useCallback((id) => setSelectedTools(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]), []);
  const handleQuizComplete = useCallback((results) => setQuizResults(results), []);
  const handleGoToTool = useCallback(() => { setView("ranked"); setActiveCategory("discuss"); }, []);
  const handleViewChange = (v) => { setView(v); if (v === "quiz") setQuizResults(null); if (!["radar", "benchmarks"].includes(v)) setSelectedTools([]); };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", color: "#e2e8f0", fontFamily: "'DM Sans','Segoe UI',sans-serif", paddingBottom: 60 }}>
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-track{background:#0d0d1a} ::-webkit-scrollbar-thumb{background:#2d2d4e;border-radius:2px}`}</style>

      <div style={{ background: "linear-gradient(135deg,#0d0d1a 0%,#1a1035 50%,#0d0d1a 100%)", borderBottom: "1px solid #2d2d4e", padding: isMobile ? "28px 16px 20px" : "36px 24px 28px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%,rgba(108,92,231,0.18) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6C5CE7", marginBottom: 8, fontWeight: 600 }}>AI TOOL INTELLIGENCE GUIDE</div>
        <h1 style={{ fontSize: isMobile ? "clamp(22px,7vw,32px)" : "clamp(26px,5vw,44px)", fontWeight: 800, margin: "0 0 8px", background: "linear-gradient(135deg,#ffffff 0%,#a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1 }}>
          Which AI, When
        </h1>
        <p style={{ color: "#94a3b8", fontSize: isMobile ? 13 : 14, maxWidth: 440, margin: "0 auto 18px", lineHeight: 1.6 }}>
          Ranked by use case — not hype. Pick the right tool for the right job.
        </p>
        <div style={{ display: "flex", gap: 6, justifyContent: isMobile ? "flex-start" : "center", flexWrap: isMobile ? "nowrap" : "wrap", overflowX: isMobile ? "auto" : "visible", padding: isMobile ? "0 0 4px" : "0", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => handleViewChange(v.id)} style={{
              flexShrink: 0, padding: isMobile ? "7px 14px" : "7px 16px", borderRadius: 20, border: "1px solid",
              borderColor: view === v.id ? "#6C5CE7" : "#2d2d4e",
              background: view === v.id ? "rgba(108,92,231,0.2)" : "transparent",
              color: view === v.id ? "#a78bfa" : "#64748b",
              cursor: "pointer", fontSize: isMobile ? 12 : 13, fontWeight: 600, transition: "all 0.2s", whiteSpace: "nowrap",
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      {showCategoryTabs && (
        <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: isMobile ? "14px 12px 0" : "18px 24px 0", scrollbarWidth: "none" }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)} style={{
              flexShrink: 0, padding: isMobile ? "8px 12px" : "9px 16px", borderRadius: 10, border: "1px solid",
              borderColor: activeCategory === c.id ? "#6C5CE7" : "#2d2d4e",
              background: activeCategory === c.id ? "rgba(108,92,231,0.15)" : "rgba(255,255,255,0.03)",
              color: activeCategory === c.id ? "#a78bfa" : "#64748b",
              cursor: "pointer", fontSize: isMobile ? 12 : 13, fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.2s",
            }}>{isMobile ? c.shortLabel : c.label}</button>
          ))}
        </div>
      )}
      {showCategoryTabs && (
        <div style={{ padding: isMobile ? "10px 12px 0" : "12px 24px 0", maxWidth: 700 }}>
          <p style={{ color: "#475569", fontSize: 12, margin: 0, lineHeight: 1.6 }}>{cat.description}</p>
        </div>
      )}

      {view === "quiz"       && !quizResults && <QuizView onComplete={handleQuizComplete} isMobile={isMobile} />}
      {view === "quiz"       && quizResults  && <QuizResult results={quizResults} onRetake={() => setQuizResults(null)} onGoToTool={handleGoToTool} isMobile={isMobile} />}
      {view === "ranked"     && <RankedView activeCategory={activeCategory} isMobile={isMobile} />}
      {view === "compare"    && <CompareView isMobile={isMobile} />}
      {view === "matrix"     && <MatrixView isMobile={isMobile} />}
      {view === "radar"      && <RadarView selectedTools={selectedTools} onToggleTool={toggleTool} isMobile={isMobile} />}
      {view === "benchmarks" && <BenchmarksView selectedTools={selectedTools} onToggleTool={toggleTool} isMobile={isMobile} />}

      <div style={{ textAlign: "center", padding: "32px 16px 0", color: "#2d2d4e", fontSize: 11 }}>
        Editorial scores · March 2026 · Benchmark data from public model cards
      </div>
    </div>
  );
}
