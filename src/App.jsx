import { useState, useEffect, useCallback, Component } from "react";
import { Radar, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement,
  Filler, Tooltip as ChartTooltip, Legend, CategoryScale, LinearScale, BarElement
} from 'chart.js';
import { loadAppData, getCapabilityBadges, getPricingDisplay } from './supabase.js';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler,
  ChartTooltip, Legend, CategoryScale, LinearScale, BarElement);
const THEME = {
  bg:        "#0d0d1a",
  surface:   "#13132b",
  border:    "#2d2d4e",
  purple:    "#6C5CE7",
  accent:    "#a78bfa",
  text:      "#e2e8f0",
  muted:     "#64748b",
  dimmed:    "#475569",
  subtle:    "#1e1e3a",
  success:   "#10B981",
  danger:    "#EF4444",
  warn:      "#F59E0B",
  radius:    { sm: 4, md: 10, lg: 12, xl: 18, pill: 20 },
  font:      "'DM Sans','Segoe UI',sans-serif",
};


function useBreakpoint() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return { isMobile: width < 640, isTablet: width < 900, width };
}

const BENCHMARKS_META = [
  { id: "mmlu",      label: "MMLU",      description: "Multi-task language understanding across 57 subjects (% correct)." },
  { id: "humaneval", label: "HumanEval", description: "Coding ability — % of programming problems solved correctly." },
  { id: "gsm8k",     label: "GSM8K",     description: "Grade school math reasoning (% correct)." },
];
const MEDALS = ["🥇", "🥈", "🥉", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const MEDAL_COLORS = ["#F59E0B", "#9CA3AF", "#CD7C3C", "#6B7280", "#6B7280", "#6B7280", "#6B7280", "#6B7280", "#6B7280", "#6B7280", "#6B7280", "#6B7280"];

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
    { label: "Free only",         value: "free"      },
    { label: "Up to $20/month",   value: "mid"       },
    { label: "Whatever it takes", value: "unlimited" },
  ]},
  { id: "tech_comfort", question: "How technical are you?", emoji: "🛠️", options: [
    { label: "Non-technical — I just need it to work", value: "low"  },
    { label: "Comfortable but not a developer",        value: "mid"  },
    { label: "Developer or power user",                value: "high" },
  ]},
];

function scoreToolsFromAnswers(tools, answers) {
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
    // Use new structured field; fall back to legacy pricing.free for safety
    const isFree = tool.hasFreeTier ?? !!tool.pricing?.free;
    if (answers.budget === "free" && !isFree) score -= 150;
    if (answers.budget === "mid"  && tool.proPriceUsd > 20) score -= 40;
    if (answers.tech_comfort === "high" && tool.id === "cursor")   score += 60;
    if (answers.tech_comfort === "low"  && tool.id === "cursor")   score -= 80;
    if (answers.tech_comfort === "low"  && tool.id === "chatgpt")  score += 20;
    if (answers.tech_comfort === "high" && tool.apiAccess)         score += 15;
    if (answers.tech_comfort === "high" && tool.reasoningMode)     score += 10;
    return { ...tool, quizScore: Math.max(0, Math.round(score)) };
  }).sort((a, b) => b.quizScore - a.quizScore);
}

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)].join(",");
}

function ScoreBar({ score, color }) {
  return (
    <div style={{ background: THEME.surface, borderRadius: 4, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${score}%`, height: "100%", background: color ? `linear-gradient(90deg,${color}99,${color})` : "linear-gradient(90deg,#6C5CE7,#a78bfa)", borderRadius: 4, transition: "width 0.6s ease" }} />
    </div>
  );
}

function radarChartData(selectedToolList, categories) {
  return {
    labels: categories.map(c => c.shortLabel),
    datasets: selectedToolList.map(tool => ({
      label: tool.name,
      data: categories.map(c => tool.categories[c.id]?.score || 0),
      backgroundColor: `${tool.color}33`, borderColor: tool.color,
      borderWidth: 2, pointBackgroundColor: tool.color,
    })),
  };
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 32 }}>⏳</div>
      <div style={{ color: THEME.dimmed, fontSize: 14 }}>Loading tool data…</div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 32 }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ color: "#EF4444", fontSize: 14, textAlign: "center", maxWidth: 400 }}>{message}</div>
    </div>
  );
}

function QuizView({ onComplete, isMobile, tools }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selectedOptionValue, setSelectedOptionValue] = useState(null);
  const q = QUIZ[step];
  const progress = (step / QUIZ.length) * 100;
  const handleOptionClick = (value) => {
    setSelectedOptionValue(value);
    setTimeout(() => {
      handleAnswer(value);
      setSelectedOptionValue(null);
    }, 120);
  };
  const handleAnswer = (value) => {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (step < QUIZ.length - 1) setStep(step + 1);
    else onComplete(scoreToolsFromAnswers(tools, next));
  };
  return (
    <div style={{ padding: isMobile ? "24px 16px" : "32px 24px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: THEME.dimmed }}>
          <span>Question {step + 1} of {QUIZ.length}</span><span>{Math.round(progress)}%</span>
        </div>
        <div style={{ background: THEME.surface, borderRadius: 4, height: 4 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#6C5CE7,#a78bfa)", borderRadius: 4, transition: "width 0.4s ease" }} />
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: isMobile ? 36 : 44, marginBottom: 10 }}>{q.emoji}</div>
        <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: THEME.text, margin: 0 }}>{q.question}</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.options.map(opt => (
          <button key={opt.value} onClick={() => handleOptionClick(opt.value)} style={{
            padding: isMobile ? "16px 18px" : "14px 20px", borderRadius: 12,
            border: `1px solid ${selectedOptionValue === opt.value ? THEME.purple : THEME.border}`,
            background: selectedOptionValue === opt.value ? "rgba(108,92,231,0.25)" : "rgba(255,255,255,0.04)",
            color: THEME.text, cursor: "pointer", fontSize: isMobile ? 14 : 15,
            fontWeight: 500, textAlign: "left", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = THEME.purple; e.currentTarget.style.background = "rgba(108,92,231,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = selectedOptionValue === opt.value ? THEME.purple : THEME.border; e.currentTarget.style.background = selectedOptionValue === opt.value ? "rgba(108,92,231,0.25)" : "rgba(255,255,255,0.04)"; }}
          >{opt.label}</button>
        ))}
      </div>
      {step > 0 && <button onClick={() => setStep(step - 1)} style={{ marginTop: 16, background: "none", border: "none", color: THEME.dimmed, cursor: "pointer", fontSize: 13 }}>← Back</button>}
    </div>
  );
}

function QuizResult({ results, onRetake, onGoToTool, isMobile }) {
  const top = results[0];
  const rest = results.slice(1, 4);
  return (
    <div style={{ padding: isMobile ? "24px 16px" : "32px 24px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: THEME.purple, marginBottom: 8, fontWeight: 600 }}>Your Best Match</div>
        <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: THEME.text, margin: "0 0 4px" }}>Start with {top.name}</h2>
        <p style={{ color: THEME.muted, fontSize: 13, margin: 0 }}>{top.tagline}</p>
      </div>
      <div onClick={() => onGoToTool(top.id)} style={{
        background: `linear-gradient(135deg,rgba(${hexToRgb(top.color)},0.15) 0%,rgba(13,13,26,0.9) 60%)`,
        border: `1px solid ${top.color}55`, borderRadius: 18, padding: isMobile ? 18 : 24, marginBottom: 16, cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <span style={{ fontSize: isMobile ? 32 : 40 }}>{top.avatar}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: isMobile ? 18 : 22, color: THEME.text }}>{top.name}</div>
            <div style={{ fontSize: 12, color: THEME.muted }}>{top.personality}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 900, color: top.color }}>{top.quizScore}</div>
            <div style={{ fontSize: 10, color: THEME.dimmed }}>match score</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {top.traits.map(t => <span key={t} style={{ padding: "3px 10px", borderRadius: 20, background: `${top.color}22`, border: `1px solid ${top.color}44`, color: top.accent, fontSize: 11, fontWeight: 600 }}>{t}</span>)}
        </div>
      </div>
      <div style={{ fontSize: 11, color: THEME.dimmed, marginBottom: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Also consider</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {rest.map(tool => (
          <div key={tool.id} onClick={() => onGoToTool(tool.id)} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid #2d2d4e", borderRadius: 12, padding: "12px 16px", cursor: "pointer" }}>
            <span style={{ fontSize: 20 }}>{tool.avatar}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: THEME.text }}>{tool.name}</div>
              <div style={{ fontSize: 11, color: THEME.muted }}>{tool.personality}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: tool.color }}>{tool.quizScore}</div>
          </div>
        ))}
      </div>
      <button onClick={onRetake} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid #2d2d4e", background: "transparent", color: THEME.muted, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>↺ Retake Quiz</button>
    </div>
  );
}

function RankedView({ activeCategory, isMobile, tools }) {
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
            border: `1px solid ${isExpanded ? tool.color + "55" : THEME.border}`, borderRadius: 16,
            padding: isMobile ? "14px 12px" : "18px 20px", marginBottom: 10, cursor: "pointer",
            transition: "all 0.25s", position: "relative", overflow: "hidden",
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: tool.color, borderRadius: "16px 0 0 16px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, paddingLeft: isMobile ? 6 : 8 }}>
              <div style={{ fontSize: isMobile ? 16 : 20, minWidth: 30, textAlign: "center", color: MEDAL_COLORS[i], fontWeight: 800 }}>{MEDALS[i]}</div>
              <div style={{ width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: 10, background: `linear-gradient(135deg,${tool.color}33,${tool.color}22)`, border: `1px solid ${tool.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 18 : 22, flexShrink: 0 }}>{tool.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: isMobile ? 15 : 17, color: THEME.text }}>{tool.name}</span>
                  {!isMobile && <span style={{ fontSize: 11, color: THEME.dimmed }}>{tool.maker}</span>}
                  {tool.bestFor.includes(activeCategory) && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, background: `${tool.color}33`, color: tool.accent, fontWeight: 700 }}>★ BEST</span>}
                </div>
                <div style={{ fontSize: isMobile ? 11 : 12, color: THEME.muted, marginTop: 2 }}>{tool.personality}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: tool.color, lineHeight: 1 }}>{catData.score}</div>
                <div style={{ fontSize: 10, color: THEME.dimmed }}>/ 100</div>
              </div>
              <div style={{ color: THEME.dimmed, fontSize: 12 }}>{isExpanded ? "▲" : "▼"}</div>
            </div>
            <div style={{ paddingLeft: isMobile ? 6 : 8, marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11, color: THEME.dimmed }}>
                <span style={{ fontWeight: 600, color: THEME.accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>Score</span>
                <span style={{ fontWeight: 800, color: THEME.text }}>{catData.score}<span style={{ fontWeight: 400, color: THEME.dimmed }}> / 100</span></span>
              </div>
              <div style={{ height: 10, background: THEME.subtle, borderRadius: THEME.radius.pill, overflow: "hidden" }}>
                <div style={{ width: `${catData.score}%`, height: "100%", background: tool.color, borderRadius: THEME.radius.pill, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                {getCapabilityBadges(tool).map(b => (
                  <span key={b.key} style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius.pill, fontSize: 10, color: THEME.text }}>{b.icon} {b.label}</span>
                ))}
              </div>
            </div>
            {isExpanded && (
              <div style={{ paddingLeft: isMobile ? 6 : 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid #2d2d4e" }}>
                <p style={{ color: THEME.subtle, fontSize: isMobile ? 13 : 14, lineHeight: 1.7, margin: "0 0 12px" }}>{catData.notes}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {tool.traits.map(t => <span key={t} style={{ padding: "4px 10px", borderRadius: 20, background: `${tool.color}22`, border: `1px solid ${tool.color}44`, color: tool.accent, fontSize: 11, fontWeight: 600 }}>{t}</span>)}
                </div>
                <div style={{ padding: "8px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, display: "inline-flex", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: THEME.muted }}>💰 {getPricingDisplay(tool)}</span>
                  <span style={{ fontSize: 12, color: THEME.subtle, fontStyle: "italic" }}>💡 {tool.tagline}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Matrix category tooltip definitions ────────────────────────────────────
const MATRIX_TOOLTIPS = {
  discuss: { title: "Discuss & Plan", body: "How well this tool thinks alongside you — brainstorming, structuring ideas, and reasoning through problems. High score = great thinking partner. Low score = better for tasks than conversation." },
  build:   { title: "Build & Execute", body: "How capable this tool is at writing code, running automations, and completing multi-step tasks. High score = it can ship things. Low score = better at explaining than doing." },
  analyse: { title: "Understand & Analyse", body: "How reliably this tool processes complex inputs — documents, data, research questions. High score = trust it with hard problems. Low score = may hallucinate under pressure." },
  write:   { title: "Write & Communicate", body: "How strong this tool is at producing polished written output — emails, reports, copy. High score = writes like a human. Low score = output needs heavy editing." },
  create:  { title: "Create & Visualise", body: "How capable this tool is at producing visual or creative output — images, novel ideas, design assets. High score = makes things you'd actually use. Low score = text-first tool." },
};

function MatrixTooltip({ catId, children }) {
  const [visible, setVisible] = useState(false);
  const tip = MATRIX_TOOLTIPS[catId];
  if (!tip) return children;
  return (
    <div
      style={{ position: "relative", display: "flex", justifyContent: "center" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "#1a1a35", border: "1px solid #2d2d4e", borderRadius: 10,
          padding: "10px 14px", width: 220, zIndex: 50, pointerEvents: "none",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: THEME.accent, marginBottom: 5 }}>{tip.title}</div>
          <div style={{ fontSize: 11, color: THEME.subtle, lineHeight: 1.55 }}>{tip.body}</div>
          {/* Arrow */}
          <div style={{ position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)", width: 8, height: 8, background: "#1a1a35", border: "1px solid #2d2d4e", borderRight: "none", borderBottom: "none", rotate: "45deg" }} />
        </div>
      )}
    </div>
  );
}

function MatrixView({ isMobile, tools, categories }) {
  const [activeCell, setActiveCell] = useState(null);
  const handleCellClick = (toolId, catId, e) => {
    e.stopPropagation();
    const key = `${toolId}-${catId}`;
    setActiveCell(prev => prev === key ? null : key);
  };
  // Mobile: stacked expandable cards (unchanged)
  if (isMobile) {
    const [expandedTool, setExpandedTool] = useState(null);
    return (
      <div style={{ padding: "16px 12px 0" }}>
        {tools.map(tool => (
          <div key={tool.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #2d2d4e", borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
            <div onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px", cursor: "pointer", borderLeft: `3px solid ${tool.color}` }}>
              <span style={{ fontSize: 22 }}>{tool.avatar}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: THEME.text }}>{tool.name}</div>
                <div style={{ fontSize: 11, color: THEME.muted }}>{tool.personality}</div>
              </div>
              <div style={{ color: THEME.dimmed, fontSize: 12 }}>{expandedTool === tool.id ? "▲" : "▼"}</div>
            </div>
            {expandedTool === tool.id && (
              <div style={{ padding: "12px 14px", borderTop: "1px solid #2d2d4e" }}>
                {categories.map(c => {
                  const d = tool.categories[c.id];
                  if (!d) return null;
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, minWidth: 72, color: THEME.muted }}>{c.shortLabel}</span>
                      <ScoreBar score={d.score} color={d.rank === 1 ? tool.color : undefined} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: d.rank === 1 ? tool.color : THEME.subtle, minWidth: 28, textAlign: "right" }}>{d.score}</span>
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

  // Desktop: full grid
  const toolColWidth = 180;
  const catColWidth  = 130;
  const minWidth     = toolColWidth + categories.length * catColWidth;

  function scoreColor(score) {
    if (score >= 85) return "#10b981";
    if (score >= 70) return THEME.accent;
    if (score >= 55) return "#f59e0b";
    return THEME.muted;
  }

  return (
    <div style={{ padding: "24px 24px 0", overflowX: "auto" }}>
      <div style={{ minWidth, maxWidth: 1100, margin: "0 auto" }}>

        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `${toolColWidth}px repeat(${categories.length}, ${catColWidth}px)`,
          gap: 6, marginBottom: 6,
          position: "sticky", top: 0, zIndex: 10,
          background: THEME.bg, paddingBottom: 4,
        }}>
          <div /> {/* empty corner */}
          {categories.map(c => (
            <MatrixTooltip key={c.id} catId={c.id}>
              <div style={{
                textAlign: "center", padding: "8px 6px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid #2d2d4e", borderRadius: 8,
                cursor: "default",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: THEME.accent, letterSpacing: "0.04em", lineHeight: 1.3 }}>{c.shortLabel}</div>
                <div style={{ fontSize: 9, color: THEME.dimmed, marginTop: 2 }}>hover for info ↑</div>
              </div>
            </MatrixTooltip>
          ))}
        </div>

        {/* Tool rows */}
        {tools.map(tool => (
          <div key={tool.id} style={{
            display: "grid",
            gridTemplateColumns: `${toolColWidth}px repeat(${categories.length}, ${catColWidth}px)`,
            gap: 6, marginBottom: 6,
          }}>
            {/* Tool name cell */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid #2d2d4e`,
              borderLeft: `3px solid ${tool.color}`,
              borderRadius: 10, padding: "10px 12px",
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{tool.avatar}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: THEME.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tool.name}</div>
                <div style={{ fontSize: 10, color: THEME.dimmed, marginTop: 1 }}>{tool.provider ?? tool.maker}</div>
              </div>
            </div>

            {/* Score cells */}
            {categories.map(c => {
              const d = tool.categories[c.id];
              if (!d) return <div key={c.id} style={{ borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid #1a1a2e" }} />;
              const isTop = d.rank === 1;
              const col   = scoreColor(d.score);
              const cellKey = `${tool.id}-${c.id}`;
              const isOpen  = activeCell === cellKey;
              return (
                <div key={c.id}
                  onClick={(e) => handleCellClick(tool.id, c.id, e)}
                  style={{
                    background: isTop ? `${tool.color}22` : "rgba(255,255,255,0.03)",
                    border: isOpen ? `1px solid ${THEME.purple}` : isTop ? `1px solid ${tool.color}55` : "1px solid #2d2d4e",
                    borderRadius: 10, cursor: "pointer", position: "relative",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    padding: "10px 6px", gap: 3,
                  }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: isTop ? tool.color : col, lineHeight: 1 }}>{d.score}</div>
                  <div style={{ fontSize: 10, color: THEME.dimmed }}>{MEDALS[d.rank - 1]}</div>
                  <div style={{ width: "80%", height: 3, background: THEME.surface, borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                    <div style={{ width: `${d.score}%`, height: "100%", background: isTop ? tool.color : col, borderRadius: 2 }} />
                  </div>
                  {isOpen && (
                    <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: "10px 12px", width: 190, zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.6)", fontSize: 11, textAlign: "left", pointerEvents: "none" }}>
                      <div style={{ fontWeight: 700, color: THEME.accent, marginBottom: 4 }}>{tool.name} · {c.shortLabel}</div>
                      <div style={{ color: THEME.text, lineHeight: 1.5 }}>{d.notes || "No notes available."}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, padding: "16px 0 8px", justifyContent: "flex-end" }}>
          {[["#10b981","85–100 Excellent"],[THEME.accent,"70–84 Good"],["#f59e0b","55–69 Fair"],[THEME.muted,"< 55 Limited"]].map(([c, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
              <span style={{ fontSize: 10, color: THEME.dimmed }}>{l}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function CompareView({ isMobile, tools, categories }) {
  const [selectedIds, setSelectedIds] = useState(["claude", "gpt"]);
  const toggle = (id) => setSelectedIds(prev => prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id]);
  const selected = tools.filter(t => selectedIds.includes(t.id));
  const barData = {
    labels: categories.map(c => c.shortLabel),
    datasets: selected.map(t => ({
      label: t.name, data: categories.map(c => t.categories[c.id]?.score || 0),
      backgroundColor: t.color + "99", borderColor: t.color, borderWidth: 2, borderRadius: 4,
    })),
  };
  const sharedCfg = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#e2e8f0", padding: 16 } }, tooltip: { backgroundColor: THEME.surface, titleColor: THEME.text, bodyColor: THEME.subtle } },
    animation: { duration: 500 },
  };
  const barOptions = { ...sharedCfg, scales: { y: { beginAtZero: false, min: 30, max: 100, grid: { color: "#1e2a3a" }, ticks: { color: THEME.muted } }, x: { grid: { color: "#1e2a3a" }, ticks: { color: THEME.subtle, font: { size: isMobile ? 10 : 12 } } } } };
  const radarOptions = { ...sharedCfg, scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, color: THEME.dimmed }, grid: { color: THEME.border }, angleLines: { color: THEME.border }, pointLabels: { color: THEME.subtle, font: { size: isMobile ? 10 : 12 } } } }, plugins: { ...sharedCfg.plugins, legend: { ...sharedCfg.plugins.legend, position: "bottom" } } };
  return (
    <div style={{ padding: isMobile ? "16px 12px 0" : "20px 24px 0", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: THEME.dimmed, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Select tools to compare {selected.length >= 4 && <span style={{ color: THEME.warn }}>· max 4</span>}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tools.map(t => {
            const isSel = selectedIds.includes(t.id);
            const isDisabled = !isSel && selected.length >= 4;
            return (
              <button key={t.id} onClick={() => !isDisabled && toggle(t.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: isMobile ? "8px 12px" : "10px 14px", borderRadius: 12, border: `2px solid ${isSel ? t.color : "transparent"}`, background: isSel ? `${t.color}18` : THEME.surface, color: isSel ? t.accent : THEME.muted, cursor: isDisabled ? "not-allowed" : "pointer", fontSize: isMobile ? 12 : 13, fontWeight: 600, transition: "all 0.15s", opacity: isDisabled ? 0.4 : 1, boxShadow: isSel ? `0 0 10px ${t.color}33` : "none" }}>
                <span style={{ fontSize: 18 }}>{t.avatar}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700, color: isSel ? t.accent : THEME.text, fontSize: isMobile ? 12 : 13 }}>{t.name}</div>
                  {!isMobile && <div style={{ fontSize: 10, color: THEME.dimmed, marginTop: 1 }}>{t.tagline}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {selected.length === 0 && (
        <div style={{ padding: "60px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 48 }}>🔍</div>
          <h3 style={{ color: THEME.text, margin: 0 }}>Select tools to compare</h3>
          <p style={{ color: THEME.muted, margin: 0, fontSize: 14 }}>Choose two or more tools from the list above</p>
        </div>
      )}
      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: THEME.subtle, marginBottom: 16 }}>CATEGORY SCORES</div>
        <div style={{ height: isMobile ? 220 : 300 }}><Bar data={barData} options={barOptions} /></div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: THEME.subtle, marginBottom: 16 }}>RADAR OVERLAY</div>
        <div style={{ maxWidth: 480, margin: "0 auto", height: isMobile ? 260 : 380 }}>
          <Radar data={radarChartData(selected, categories)} options={radarOptions} />
        </div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 20 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: THEME.subtle, marginBottom: 16 }}>HEAD-TO-HEAD</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 12 : 13 }}>
            <thead><tr>
              <td style={{ padding: "8px 12px", color: THEME.dimmed, fontWeight: 600, borderBottom: "1px solid #2d2d4e" }}>Category</td>
              {selected.map(t => <td key={t.id} style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #2d2d4e", color: t.color, fontWeight: 700 }}>{t.avatar} {t.name}</td>)}
            </tr></thead>
            <tbody>
              {categories.map(c => {
                const scores = selected.map(t => t.categories[c.id]?.score || 0);
                const maxScore = Math.max(...scores);
                return (
                  <tr key={c.id}>
                    <td style={{ padding: "10px 12px", color: THEME.muted, borderBottom: "1px solid #1a1a2e" }}>{c.label}</td>
                    {selected.map(t => { const score = t.categories[c.id]?.score || 0; const isWinner = score === maxScore; return <td key={t.id} style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #1a1a2e", fontWeight: isWinner ? 800 : 500, color: isWinner ? t.color : THEME.muted, fontSize: isWinner ? 15 : 13 }}>{isWinner ? "★ " : ""}{score}</td>; })}
                  </tr>
                );
              })}
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                <td style={{ padding: "10px 12px", color: THEME.subtle, fontWeight: 700 }}>Overall avg</td>
                {selected.map(t => { const avg = Math.round(Object.values(t.categories).reduce((s, c) => s + c.score, 0) / Object.values(t.categories).length); return <td key={t.id} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, color: t.color, fontSize: 16 }}>{avg}</td>; })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RadarView({ selectedTools: sel, onToggleTool, isMobile, tools, categories }) {
  const selected = tools.filter(t => sel.includes(t.id));
  const radarOptions = {
    scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, color: THEME.subtle }, grid: { color: THEME.border }, angleLines: { color: THEME.border }, pointLabels: { color: "#e2e8f0", font: { size: isMobile ? 10 : 12 } } } },
    plugins: { legend: { display: true, position: "bottom", labels: { color: "#e2e8f0", padding: 16 } } },
    animation: { duration: 600 },
  };
  return (
    <div style={{ padding: isMobile ? "16px 12px 0" : "24px", maxWidth: 800, margin: "0 auto" }}>
      <p style={{ textAlign: "center", color: THEME.muted, fontSize: 13, marginBottom: 16 }}>Select tools to overlay on the radar</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
        {tools.map(t => (
          <button key={t.id} onClick={() => onToggleTool(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "7px 12px" : "8px 14px", borderRadius: 20, border: `1px solid ${sel.includes(t.id) ? t.color : THEME.border}`, background: sel.includes(t.id) ? `${t.color}22` : "transparent", color: sel.includes(t.id) ? t.accent : THEME.muted, cursor: "pointer", fontSize: isMobile ? 12 : 13, fontWeight: 600, transition: "all 0.2s" }}><span>{t.avatar}</span>{t.name}</button>
        ))}
      </div>
      {selected.length > 0 ? (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 24 }}>
          <div style={{ maxWidth: 500, margin: "0 auto", height: isMobile ? 280 : 420 }}>
            <Radar data={radarChartData(selected, categories)} options={radarOptions} />
          </div>
        </div>
      ) : (
        <div style={{ padding: "60px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 48, color: THEME.dimmed }}>🕸️</div>
          <h3 style={{ color: THEME.text, margin: 0 }}>Select tools to compare</h3>
          <p style={{ color: THEME.muted, margin: 0, fontSize: 14 }}>Use the toggles above to add tools to the chart</p>
        </div>
      )}
    </div>
  );
}

function BenchmarksView({ selectedTools: sel, onToggleTool, isMobile, tools }) {
  const selected = tools.filter(t => sel.includes(t.id));
  const percentData = { labels: BENCHMARKS_META.map(b => b.label), datasets: selected.map(t => ({ label: t.name, data: BENCHMARKS_META.map(b => t.benchmarks[b.id] ?? null), backgroundColor: t.color + "88", borderColor: t.color, borderWidth: 1 })) };
  const eloData = { labels: ["Arena Elo"], datasets: selected.map(t => ({ label: t.name, data: [t.arenaElo ?? null], backgroundColor: t.color + "88", borderColor: t.color, borderWidth: 1 })) };
  const baseOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#e2e8f0" } }, tooltip: { backgroundColor: THEME.surface, bodyColor: THEME.subtle, titleColor: THEME.text } }, animation: { duration: 500 } };
  const pOpts = { ...baseOpts, scales: { y: { beginAtZero: false, min: 60, max: 100, grid: { color: "#1e2a3a" }, ticks: { color: THEME.muted } }, x: { grid: { color: "#1e2a3a" }, ticks: { color: THEME.subtle } } } };
  const eOpts = { ...baseOpts, scales: { y: { beginAtZero: false, min: 1100, grid: { color: "#1e2a3a" }, ticks: { color: THEME.muted } }, x: { grid: { color: "#1e2a3a" }, ticks: { color: THEME.subtle } } } };
  return (
    <div style={{ padding: isMobile ? "16px 12px 0" : "24px", maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
        {tools.map(t => (
          <button key={t.id} onClick={() => onToggleTool(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "7px 12px" : "8px 14px", borderRadius: 20, border: `1px solid ${sel.includes(t.id) ? t.color : THEME.border}`, background: sel.includes(t.id) ? `${t.color}22` : "transparent", color: sel.includes(t.id) ? t.accent : THEME.muted, cursor: "pointer", fontSize: isMobile ? 12 : 13, fontWeight: 600, transition: "all 0.2s" }}><span>{t.avatar}</span>{t.name}</button>
        ))}
      </div>
      {selected.length > 0 ? (
        <>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: THEME.text, marginBottom: 4 }}>Knowledge & Coding Benchmarks</div>
            <div style={{ fontSize: 11, color: THEME.dimmed, marginBottom: 16 }}>MMLU / HumanEval / GSM8K — all % correct. Null = not publicly tested.</div>
            <div style={{ height: isMobile ? 200 : 280 }}><Bar data={percentData} options={pOpts} /></div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #2d2d4e", borderRadius: 16, padding: isMobile ? 14 : 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: THEME.text, marginBottom: 4 }}>Chatbot Arena — Human Preference (Elo)</div>
            <div style={{ fontSize: 11, color: THEME.dimmed, marginBottom: 16 }}>Blind head-to-head votes. Scale ~1100–1350. Higher = more preferred.</div>
            <div style={{ height: isMobile ? 180 : 240 }}><Bar data={eloData} options={eOpts} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 10 }}>
            {BENCHMARKS_META.map(b => (
              <div key={b.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px", border: "1px solid #2d2d4e" }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: THEME.accent, marginBottom: 4 }}>{b.label}</div>
                <div style={{ fontSize: 11, color: THEME.muted, lineHeight: 1.5 }}>{b.description}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ padding: "60px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 48, color: THEME.dimmed }}>🏆</div>
          <h3 style={{ color: THEME.text, margin: 0 }}>Select tools to compare</h3>
          <p style={{ color: THEME.muted, margin: 0, fontSize: 14 }}>Use the toggles above to add tools to the chart</p>
        </div>
      )}
    </div>
  );
}


const Navigation = ({ currentView, onViewChange, isMobile, isTablet }) => {
  const isBottomNav = isMobile || isTablet;
  const navContainerStyle = isBottomNav
    ? { position: 'fixed', bottom: 0, left: 0, right: 0, height: '64px', backgroundColor: THEME.surface, borderTop: `1px solid ${THEME.border}`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 1000, padding: '0 10px' }
    : { position: 'fixed', left: 0, top: 0, bottom: 0, width: '220px', backgroundColor: THEME.surface, borderRight: `1px solid ${THEME.border}`, display: 'flex', flexDirection: 'column', padding: '24px 16px', zIndex: 1000 };

  return (
    <nav style={navContainerStyle}>
      {!isBottomNav && (
        <div style={{ marginBottom: '32px', paddingLeft: '12px' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: THEME.purple, marginBottom: 4, fontWeight: 600 }}>AI Tool Guide</div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: THEME.accent, letterSpacing: '-0.02em', margin: 0 }}>Which AI, When</h1>
        </div>
      )}
      {VIEWS.map((v) => {
        const isActive = currentView === v.id;
        const parts = v.label.split(' ');
        const icon = parts[0];
        const labelText = parts.slice(1).join(' ');
        const buttonStyle = isBottomNav
          ? { background: 'none', border: 'none', color: isActive ? THEME.purple : THEME.muted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 8px', transition: 'color 0.2s ease' }
          : { background: isActive ? `${THEME.purple}18` : 'none', border: isActive ? `1px solid ${THEME.purple}40` : '1px solid transparent', borderRadius: '8px', color: isActive ? THEME.accent : THEME.text, padding: '10px 14px', marginBottom: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', transition: 'all 0.2s ease', fontWeight: isActive ? 600 : 400, fontSize: 14 };
        return (
          <button key={v.id} onClick={() => onViewChange(v.id)} style={buttonStyle}>
            <span style={{ fontSize: isBottomNav ? '22px' : '16px', lineHeight: 1 }}>{icon}</span>
            {!isBottomNav && <span>{labelText}</span>}
            {isBottomNav && <span style={{ fontSize: 9, color: isActive ? THEME.purple : THEME.dimmed, fontWeight: isActive ? 600 : 400 }}>{labelText}</span>}
          </button>
        );
      })}
    </nav>
  );
};

const VIEWS = [
  { id: "quiz",       label: "❓ Quiz"       },
  { id: "ranked",     label: "📊 Ranked"     },
  { id: "compare",    label: "⚖️ Compare"    },
  { id: "matrix",     label: "🔲 Matrix"     },
  { id: "radar",      label: "🕸️ Radar"      },
  { id: "benchmarks", label: "🏆 Benchmarks" },
];

export default function AIGuide() {
  const { isMobile, isTablet } = useBreakpoint();
  const [view, setView] = useState("quiz");
  const [activeCategory, setActiveCategory] = useState("discuss");
  const [selectedTools, setSelectedTools] = useState([]);
  const [quizResults, setQuizResults] = useState(null);
  const [tools, setTools] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAppData()
      .then(({ tools, categories }) => {
        setTools(tools);
        setCategories(categories);
      })
      .catch(err => setError(`Failed to load data: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  const showCategoryTabs = view === "ranked";
  const cat = categories.find(c => c.id === activeCategory);
  const toggleTool = useCallback((id) => setSelectedTools(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]), []);
  const handleQuizComplete = useCallback((results) => setQuizResults(results), []);
  const handleGoToTool = useCallback(() => { setView("ranked"); setActiveCategory("discuss"); }, []);
  const handleViewChange = (v) => { setView(v); if (v === "quiz") setQuizResults(null); if (!["radar", "benchmarks"].includes(v)) setSelectedTools([]); };

  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen message={error} />;

  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, color: THEME.text, fontFamily: THEME.font }}>
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-track{background:#0d0d1a} ::-webkit-scrollbar-thumb{background:#2d2d4e;border-radius:2px}`}</style>
      <Navigation currentView={view} onViewChange={handleViewChange} isMobile={isMobile} isTablet={isTablet} />
      <main style={{ marginLeft: (isMobile || isTablet) ? 0 : '220px', paddingBottom: (isMobile || isTablet) ? '80px' : '24px', paddingTop: (isMobile || isTablet) ? '20px' : '0', transition: 'margin-left 0.3s ease' }}>
        <header style={{ padding: (isMobile || isTablet) ? '0 20px 20px' : '36px 40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
          {!(isMobile || isTablet) && (
            <p style={{ color: THEME.dimmed, fontSize: 13, margin: 0 }}>Ranked by use case — not hype. Pick the right tool for the right job.</p>
          )}
        </header>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: (isMobile || isTablet) ? '0 16px' : '0 40px' }}>
      {showCategoryTabs && (
        <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: isMobile ? "14px 12px 0" : "18px 24px 0", scrollbarWidth: "none" }}>
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)} style={{ flexShrink: 0, padding: isMobile ? "8px 12px" : "9px 16px", borderRadius: 10, border: "1px solid", borderColor: activeCategory === c.id ? THEME.purple : THEME.border, background: activeCategory === c.id ? "rgba(108,92,231,0.15)" : "rgba(255,255,255,0.03)", color: activeCategory === c.id ? THEME.accent : THEME.muted, cursor: "pointer", fontSize: isMobile ? 12 : 13, fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.2s" }}>{isMobile ? c.shortLabel : c.label}</button>
          ))}
        </div>
      )}
      {showCategoryTabs && cat && (
        <div style={{ padding: isMobile ? "10px 12px 0" : "12px 24px 0", maxWidth: 700 }}>
          <p style={{ color: THEME.dimmed, fontSize: 12, margin: 0, lineHeight: 1.6 }}>{cat.description}</p>
        </div>
      )}
      {view === "quiz"       && !quizResults && <QuizView onComplete={handleQuizComplete} isMobile={isMobile} tools={tools} />}
      {view === "quiz"       && quizResults  && <QuizResult results={quizResults} onRetake={() => setQuizResults(null)} onGoToTool={handleGoToTool} isMobile={isMobile} />}
      {view === "ranked"     && <RankedView activeCategory={activeCategory} isMobile={isMobile} tools={tools} />}
      {view === "compare"    && <CompareView isMobile={isMobile} tools={tools} categories={categories} />}
      {view === "matrix"     && <MatrixView isMobile={isMobile} tools={tools} categories={categories} />}
      {view === "radar"      && <RadarView selectedTools={selectedTools} onToggleTool={toggleTool} isMobile={isMobile} tools={tools} categories={categories} />}
      {view === "benchmarks" && <BenchmarksView selectedTools={selectedTools} onToggleTool={toggleTool} isMobile={isMobile} tools={tools} />}
        <div style={{ textAlign: "center", padding: "32px 16px 24px", color: THEME.dimmed, fontSize: 11 }}>
          Editorial scores · March 2026 · Benchmark data from public model cards
        </div>
        </div>
      </main>
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: 48, textAlign: "center", color: "#fff", background: THEME.surface, minHeight: "100vh" }}>
        <h2 style={{ color: "#e55" }}>Something went wrong</h2>
        <pre style={{ color: "#aaa", fontSize: 12 }}>{this.state.error?.message}</pre>
      </div>
    );
    return this.props.children;
  }
}

export { ErrorBoundary };
