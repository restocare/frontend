"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

import apiClient from "@/app/api/apiClient";
import { getToken } from "@/src/api/apiClient";
import { useAuthStore } from "@/store/authStore";

const PhoneInput = dynamic(() => import("@/app/real-estate/components/PhoneInputClient"), {
    ssr: false,
    loading: () => <div className="h-10 sm:h-9 w-full bg-accent animate-pulse rounded-md"></div>
});

// ── Types ────────────────────────────────────────────────────────────────────
type PillState = "disconnected" | "live" | "agent" | "error" | "connecting";
type MsgRole = "agent" | "user" | "sys" | "tool" | "tool-result";

interface Message {
  id: number;
  role: MsgRole;
  text: string;
  ts: string;
}

interface LogEntry {
  id: number;
  text: string;
  type: "i" | "s" | "e" | "w" | "";
}

interface LatencyTurn {
  turn: number;
  kind: "greeting" | "response";
  ms: number;
  at: string;
}

// ── Latency rating ───────────────────────────────────────────────────────────
type LatencyRating = "fast" | "moderate" | "slow";

function rateLatency(ms: number): LatencyRating {
  if (ms < 800) return "fast";
  if (ms < 1500) return "moderate";
  return "slow";
}

const ratingMeta: Record<LatencyRating, { label: string; text: string; bg: string; bar: string }> = {
  fast: { label: "Fast", text: "text-[#4ade80]", bg: "bg-[#4ade80]/10 border-[#4ade80]/20", bar: "bg-[#4ade80]" },
  moderate: { label: "Moderate", text: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20", bar: "bg-amber-500" },
  slow: { label: "Slow", text: "text-destructive", bg: "bg-destructive/10 border-destructive/20", bar: "bg-destructive" },
};

// ── Constants ────────────────────────────────────────────────────────────────
// Derive the WS endpoint from the API base URL (the gateway listens on the
// same HTTP server, outside the /api REST prefix — see calls.gateway.ts).
const API_HOST = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api"
).replace(/\/api\/?$/, "");
const BACKEND_WS = `${API_HOST.replace(/^http/, "ws")}/calls/monitor-stream`;

// ── Helpers ──────────────────────────────────────────────────────────────────
let msgIdCounter = 0;
let logIdCounter = 0;
const newMsgId = () => ++msgIdCounter;
const newLogId = () => ++logIdCounter;

// ── Pill component ───────────────────────────────────────────────────────────
function Pill({ state, label }: { state: PillState; label: string }) {
  const base =
    "flex items-center gap-[7px] px-[14px] py-[5px] rounded-full border text-xs transition-all duration-300";
  const variants: Record<PillState, string> = {
    disconnected: "border-border text-muted-foreground bg-background",
    connecting: "border-border text-muted-foreground bg-background",
    live: "border-[#4ade80]/20 text-[#4ade80] bg-[#4ade80]/10",
    agent: "border-[#7c6aff]/20 text-[#7c6aff] bg-[#7c6aff]/10",
    error: "border-destructive/20 text-destructive bg-destructive/10",
  };
  const dotVariants: Record<PillState, string> = {
    disconnected: "bg-muted-foreground",
    connecting: "bg-muted-foreground animate-pulse",
    live: "bg-[#4ade80] animate-pulse",
    agent: "bg-[#7c6aff] animate-pulse",
    error: "bg-destructive",
  };
  return (
    <div className={`${base} ${variants[state]}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotVariants[state]}`} />
      <span>{label}</span>
    </div>
  );
}

// ── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === "sys") {
    return (
      <div className="flex justify-center animate-[up_0.2s_ease]">
        <div className="bg-accent text-muted-foreground border border-border rounded-lg text-xs px-[13px] py-[9px] max-w-[94%] text-center leading-[1.55]">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.role === "tool") {
    return (
      <div className="flex justify-center animate-[up_0.2s_ease]">
        <div className="bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg font-mono text-[11px] px-[13px] py-[9px] max-w-[94%] leading-[1.55]">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.role === "tool-result") {
    return (
      <div className="flex justify-center animate-[up_0.2s_ease]">
        <div className="bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/20 rounded-lg font-mono text-[11px] px-[13px] py-[9px] max-w-[94%] leading-[1.55]">
          {msg.text}
        </div>
      </div>
    );
  }
  const isAgent = msg.role === "agent";
  return (
    <div className={`flex gap-2 items-start animate-[up_0.2s_ease] ${isAgent ? "flex-row" : "flex-row-reverse"}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${isAgent
            ? "bg-[#7c6aff]/10 text-[#7c6aff] border border-[#7c6aff]/20"
            : "bg-accent text-muted-foreground border border-border"
          }`}
      >
        {isAgent ? "AI" : "You"}
      </div>
      <div>
        <div
          className={`max-w-[72%] px-[13px] py-[9px] text-[13px] leading-[1.55] ${isAgent
              ? "bg-accent text-foreground border border-border rounded-[4px_14px_14px_14px]"
              : "bg-primary text-primary-foreground rounded-[14px_4px_14px_14px]"
            }`}
        >
          {msg.text}
        </div>
        <div className={`text-[10px] text-muted-foreground mt-[3px] ${!isAgent ? "text-right" : ""}`}>
          {msg.ts}
        </div>
      </div>
    </div>
  );
}

// ── Log line ─────────────────────────────────────────────────────────────────
function LogLine({ entry }: { entry: LogEntry }) {
  const colors: Record<string, string> = {
    "": "text-muted-foreground",
    i: "text-[#7c6aff]",
    s: "text-[#4ade80]",
    e: "text-destructive",
    w: "text-yellow-500",
  };
  return (
    <div className={`leading-[1.8] ${colors[entry.type] ?? "text-muted-foreground"}`}>
      {entry.text}
    </div>
  );
}

// ── Latency Analyzer ─────────────────────────────────────────────────────────
function StatBox({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-background border border-border rounded-md px-3 py-2.5">
      <span className="text-[10px] uppercase tracking-[.06em] text-muted-foreground font-medium">{label}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums">
        {value}
        {unit && <span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

function LatencyAnalyzer({ turns }: { turns: LatencyTurn[] }) {
  const count = turns.length;
  const last = count > 0 ? turns[count - 1] : null;

  // Aggregate stats over the session.
  const values = turns.map((t) => t.ms);
  const avg = count > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / count) : 0;
  const min = count > 0 ? Math.min(...values) : 0;
  const max = count > 0 ? Math.max(...values) : 0;
  const sorted = [...values].sort((a, b) => a - b);
  const p95 = count > 0 ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : 0;

  const lastRating = last ? rateLatency(last.ms) : "fast";
  const lastMeta = ratingMeta[lastRating];

  // Bar chart — show the most recent 24 turns, scaled to the session max.
  const recent = turns.slice(-24);
  const chartMax = Math.max(max, 1);

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Latency Analyzer</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Time to first response per turn</p>
        </div>
        {last && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${lastMeta.bg}`}>
            <span className={`w-2 h-2 rounded-full ${lastMeta.bar}`} />
            <span className={`font-medium ${lastMeta.text}`}>{lastMeta.label}</span>
          </div>
        )}
      </div>

      {count === 0 ? (
        <div className="flex items-center justify-center text-muted-foreground text-sm p-10">
          Latency appears here once the agent starts responding
        </div>
      ) : (
        <div className="p-5 flex flex-col gap-5">
          {/* current latency hero + stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className={`flex flex-col gap-1 rounded-md px-3 py-2.5 border ${lastMeta.bg}`}>
              <span className="text-[10px] uppercase tracking-[.06em] text-muted-foreground font-medium">Last turn</span>
              <span className={`text-sm font-semibold tabular-nums ${lastMeta.text}`}>
                {last!.ms}
                <span className="text-[10px] ml-0.5 opacity-70">ms</span>
              </span>
            </div>
            <StatBox label="Average" value={String(avg)} unit="ms" />
            <StatBox label="Fastest" value={String(min)} unit="ms" />
            <StatBox label="Slowest" value={String(max)} unit="ms" />
            <StatBox label="P95" value={String(p95)} unit="ms" />
          </div>

          {/* per-turn bar chart */}
          <div>
            <div className="flex items-end gap-[3px] h-28 w-full">
              {recent.map((t) => {
                const meta = ratingMeta[rateLatency(t.ms)];
                const heightPct = Math.max(4, (t.ms / chartMax) * 100);
                return (
                  <div
                    key={t.turn}
                    className="flex-1 flex flex-col justify-end items-center group relative min-w-0"
                    title={`Turn ${t.turn} · ${t.kind} · ${t.ms}ms`}
                  >
                    <div
                      className={`w-full rounded-t-sm ${meta.bar} opacity-80 group-hover:opacity-100 transition-all`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>{recent.length === count ? "Turn 1" : `Turn ${recent[0].turn}`}</span>
              <span>{count} turn{count === 1 ? "" : "s"}</span>
              <span>Turn {last!.turn}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Post-call Report (circular gauge) ────────────────────────────────────────
function LatencyReport({ turns }: { turns: LatencyTurn[] }) {
  const count = turns.length;
  const values = turns.map((t) => t.ms);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / count);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Map average latency → 0-100 performance score (faster = higher).
  const score = Math.max(0, Math.min(100, Math.round(100 - ((avg - 500) / (2500 - 500)) * 100)));
  const rating = rateLatency(avg);
  const meta = ratingMeta[rating];

  // SVG ring geometry.
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const strokeColor = rating === "fast" ? "#4ade80" : rating === "moderate" ? "#f59e0b" : "#ef4444";

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Call Report</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Session ended · {count} turn{count === 1 ? "" : "s"}</p>
        </div>
        <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${meta.bg} ${meta.text}`}>
          {meta.label}
        </span>
      </div>

      <div className="p-5 flex flex-col sm:flex-row items-center gap-6">
        {/* circular gauge */}
        <div className="relative flex-shrink-0" style={{ width: 132, height: 132 }}>
          <svg width={132} height={132} className="-rotate-90">
            <circle
              cx={66}
              cy={66}
              r={radius}
              fill="none"
              strokeWidth={10}
              className="stroke-border"
            />
            <circle
              cx={66}
              cy={66}
              r={radius}
              fill="none"
              strokeWidth={10}
              stroke={strokeColor}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.8s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold tabular-nums ${meta.text}`}>{score}</span>
            <span className="text-[10px] uppercase tracking-[.06em] text-muted-foreground">Score</span>
          </div>
        </div>

        {/* summary numbers */}
        <div className="grid grid-cols-3 gap-3 w-full">
          <div className="flex flex-col gap-1 bg-background border border-border rounded-md px-3 py-2.5">
            <span className="text-[10px] uppercase tracking-[.06em] text-muted-foreground font-medium">Avg response</span>
            <span className={`text-sm font-semibold tabular-nums ${meta.text}`}>{avg}<span className="text-[10px] ml-0.5 opacity-70">ms</span></span>
          </div>
          <div className="flex flex-col gap-1 bg-background border border-border rounded-md px-3 py-2.5">
            <span className="text-[10px] uppercase tracking-[.06em] text-muted-foreground font-medium">Fastest</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{min}<span className="text-[10px] ml-0.5 text-muted-foreground">ms</span></span>
          </div>
          <div className="flex flex-col gap-1 bg-background border border-border rounded-md px-3 py-2.5">
            <span className="text-[10px] uppercase tracking-[.06em] text-muted-foreground font-medium">Slowest</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{max}<span className="text-[10px] ml-0.5 text-muted-foreground">ms</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AIAgentMonitor() {
  const [pill, setPillState] = useState<{ state: PillState; label: string }>({
    state: "disconnected",
    label: "Disconnected",
  });
  const [phone, setPhone] = useState("+91");
  const [leadName, setLeadName] = useState("Shaban Khan");
  const [project, setProject] = useState("Shree Kunj Greens");
  const [budget, setBudget] = useState("50 Lakhs");
  const [leadSource, setLeadSource] = useState("Instagram Ads");
  const [resolvedPhone, setResolvedPhone] = useState<string | null>(null);
  const [projectBadge, setProjectBadge] = useState<{ text: string; type: "success" | "warn" | "none" }>({ text: "", type: "none" });
  const [resolving, setResolving] = useState(false);
  const [sessionInfo, setSessionInfo] = useState("Set up a lead first");

  const [messages, setMessages] = useState<Message[]>([]);
  const [latencies, setLatencies] = useState<LatencyTurn[]>([]);
  const [callEnded, setCallEnded] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: newLogId(), text: "Ready.", type: "" },
  ]);
  const [micState, setMicState] = useState<"off" | "on" | "muted">("off");
  const [micStatus, setMicStatus] = useState("—");
  const [connectDisabled, setConnectDisabled] = useState(true);
  const [disconnectDisabled, setDisconnectDisabled] = useState(true);
  const [micDisabled, setMicDisabled] = useState(true);

  const msgsRef = useRef<HTMLDivElement>(null);
  const logBodyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const nextPlayRef = useRef(0);
  const audioQRef = useRef<Int16Array[]>([]);
  const playingRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micOnRef = useRef(false);
  const sessionReadyRef = useRef(false);
  const agentSpeakingRef = useRef(false);
  const agentMsgIdRef = useRef<number | null>(null);
  const agentBufRef = useRef("");
  const animFrameRef = useRef<number>(0);

  // scroll helpers
  const scrollMsgs = useCallback(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, []);
  const scrollLog = useCallback(() => {
    if (logBodyRef.current) logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollMsgs(); }, [messages, scrollMsgs]);
  useEffect(() => { scrollLog(); }, [logs, scrollLog]);

  // ── Logging ────────────────────────────────────────────────────────────────
  const addLog = useCallback((msg: string, t: "i" | "s" | "e" | "w" | "" = "i") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { id: newLogId(), text: `[${time}] ${msg}`, type: t }]);
  }, []);

  // ── Chat helpers ───────────────────────────────────────────────────────────
  const addMsg = useCallback((role: MsgRole, text: string): number => {
    const id = newMsgId();
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { id, role, text, ts }]);
    return id;
  }, []);

  const appendAgent = useCallback((delta: string) => {
    agentBufRef.current += delta;
    const buf = agentBufRef.current;
    if (agentMsgIdRef.current === null) {
      const id = newMsgId();
      agentMsgIdRef.current = id;
      const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setMessages((prev) => [...prev, { id, role: "agent", text: buf, ts }]);
    } else {
      const targetId = agentMsgIdRef.current;
      setMessages((prev) =>
        prev.map((m) => (m.id === targetId ? { ...m, text: buf } : m))
      );
    }
  }, []);

  const finaliseAgent = useCallback(() => {
    agentMsgIdRef.current = null;
    agentBufRef.current = "";
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setLatencies([]);
    setCallEnded(false);
    agentMsgIdRef.current = null;
    agentBufRef.current = "";
  }, []);

  // ── Waveform ───────────────────────────────────────────────────────────────
  const drawWave = useCallback(function drawWaveFn() {
    if (!analyserRef.current) return;
    animFrameRef.current = requestAnimationFrame(drawWaveFn);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== canvas.offsetWidth * dpr) {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    }
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(data);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = agentSpeakingRef.current ? "#2a2a3e" : "#7c6aff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const step = canvas.width / data.length;
    for (let i = 0; i < data.length; i++) {
      const y = (data[i] / 128.0) * (canvas.height / 2);
      if (i === 0) {
        ctx.moveTo(0, y);
      } else {
        ctx.lineTo(i * step, y);
      }
    }
    ctx.stroke();
  }, []);

  // ── Playback ───────────────────────────────────────────────────────────────
  const playNext = useCallback(async () => {
    if (playingRef.current || audioQRef.current.length === 0) return;
    playingRef.current = true;
    if (!playCtxRef.current) playCtxRef.current = new AudioContext({ sampleRate: 24000 });
    if (playCtxRef.current.state === "suspended") await playCtxRef.current.resume();
    while (audioQRef.current.length > 0) {
      const chunk = audioQRef.current.shift()!;
      const f32 = new Float32Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) f32[i] = chunk[i] / 32768;
      const buf = playCtxRef.current.createBuffer(1, f32.length, 24000);
      buf.copyToChannel(f32, 0);
      const src = playCtxRef.current.createBufferSource();
      src.buffer = buf;
      src.connect(playCtxRef.current.destination);
      const at = Math.max(playCtxRef.current.currentTime + 0.01, nextPlayRef.current);
      src.start(at);
      nextPlayRef.current = at + buf.duration;
      await new Promise((r) => setTimeout(r, 5));
    }
    playingRef.current = false;
  }, []);

  // ── Mic ────────────────────────────────────────────────────────────────────
  const stopMic = useCallback(() => {
    micOnRef.current = false;
    try { micProcRef.current?.disconnect(); } catch { }
    micProcRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    try { void audioCtxRef.current?.close(); } catch { }
    audioCtxRef.current = null;
    analyserRef.current = null;
    cancelAnimationFrame(animFrameRef.current);
    setMicState("off");
    setMicStatus(sessionReadyRef.current ? "Mic off" : "—");
  }, []);

  const startMic = useCallback(async () => {
    try {
      audioCtxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 16000 });
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const source = audioCtxRef.current.createMediaStreamSource(micStreamRef.current);
      micProcRef.current = audioCtxRef.current.createScriptProcessor(4096, 1, 1);
      micProcRef.current.onaudioprocess = (e) => {
        if (agentSpeakingRef.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !sessionReadyRef.current) return;
        const f32 = e.inputBuffer.getChannelData(0);
        const i16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) {
          i16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32768)));
        }
        wsRef.current.send(i16.buffer);
      };
      source.connect(micProcRef.current);
      micProcRef.current.connect(audioCtxRef.current.destination);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      drawWave();
      micOnRef.current = true;
      setMicState("on");
      setMicStatus("Mic active");
      addLog("Mic started at 16kHz", "s");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Mic error: ${msg}`, "e");
      addMsg("sys", `⚠ Mic error: ${msg}`);
    }
  }, [addLog, addMsg, drawWave]);

  const toggleMic = useCallback(() => {
    if (micOnRef.current) stopMic();
    else startMic();
  }, [stopMic, startMic]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    stopMic();
    setPillState({ state: "disconnected", label: "Disconnected" });
    setConnectDisabled(resolvedPhone ? false : true);
    setDisconnectDisabled(true);
    setMicDisabled(true);
    setMicStatus("—");
    audioQRef.current = [];
    nextPlayRef.current = 0;
    playingRef.current = false;
    if (resolvedPhone) {
      setPillState({ state: "live", label: "Lead Ready" });
    }
  }, [stopMic, resolvedPhone]);

  // ── Resolve Lead ───────────────────────────────────────────────────────────
  const setupLead = useCallback(async () => {
    const ph = phone.trim();
    if (!ph) {
      addLog("Phone is required", "e");
      return;
    }

    setProjectBadge({ text: "", type: "none" });
    setResolving(true);
    addLog(`Resolving lead — phone: ${ph}, project: "${project || "none"}"...`);

    try {
      // Authenticated call — apiClient attaches the JWT Bearer token.
      const { data: json } = await apiClient.post("/api/calls/test-lead", {
        phone: ph,
        name: leadName,
        project,
        budget,
        leadSource,
      });

      if (!json?.success) {
        throw new Error(json?.message ?? "Failed to resolve lead");
      }

      const data = json.data;
      setResolvedPhone(data.phone);

      if (data.projectId) {
        setProjectBadge({
          text: `Project: ${data.projectName} (${data.projectId.slice(0, 8)}...)`,
          type: "success",
        });
        addLog(`Project resolved → ${data.projectName} (${data.projectId})`, "s");
      } else if (project) {
        setProjectBadge({
          text: `Project "${project}" not found in DB — project_id will be empty`,
          type: "warn",
        });
        addLog(`Project "${project}" not found in DB`, "w");
      } else {
        setProjectBadge({
          text: "No project specified",
          type: "warn",
        });
      }

      setConnectDisabled(false);
      setSessionInfo(`Ready — ${data.phone}`);
      setPillState({ state: "live", label: "Lead Ready" });
      addLog(`Lead context stored for ${data.phone} — click Start Session`, "s");

    } catch (err: unknown) {
      const serverMsg =
        typeof err === "object" && err !== null
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      const msg =
        serverMsg ?? (err instanceof Error ? err.message : String(err));
      addLog(`Setup failed: ${msg}`, "e");
      setPillState({ state: "error", label: "Setup Error" });
    } finally {
      setResolving(false);
    }
  }, [phone, leadName, project, budget, leadSource, addLog]);

  // ── Connect ────────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    const ph = resolvedPhone || phone.trim() || "unknown";
    addLog(`Connecting — phone: ${ph}`);
    setPillState({ state: "connecting", label: "Connecting..." });

    // The monitor socket needs the admin's JWT (?token=): a browser WebSocket
    // cannot send an Authorization header. Same token source as apiClient.
    const token = getToken() ?? useAuthStore.getState().accessToken;
    if (!token) {
      addLog("Not signed in — log in again, then reconnect", "e");
      setPillState({ state: "error", label: "Not signed in" });
      return;
    }
    const wsUrl =
      `${BACKEND_WS}?phone=${encodeURIComponent(ph)}` +
      `&token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      addLog("Connected — sending config", "s");
      setLatencies([]);
      setCallEnded(false);
      ws.send(JSON.stringify({ type: "config", testPhone: ph }));
      setConnectDisabled(true);
      setDisconnectDisabled(false);
      addMsg("sys", "Connecting to AI agent with lead context...");
    };

    ws.onmessage = async (evt) => {
      if (evt.data instanceof ArrayBuffer) {
        audioQRef.current.push(new Int16Array(evt.data));
        playNext();
        return;
      }
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(evt.data as string); } catch { return; }
      addLog(`← ${msg.type}`);

      if (msg.type === "session.ready") {
        sessionReadyRef.current = true;
        setPillState({ state: "live", label: "LIVE" });
        setSessionInfo(`Live — ${ph}`);
        addMsg("sys", "🎙 Agent is live — starting mic...");
        await startMic();
        setMicDisabled(false);
      }
      if (msg.type === "agent.speaking") {
        agentSpeakingRef.current = true;
        setPillState({ state: "agent", label: "Agent Speaking" });
        setMicStatus("🔇 Muted (agent speaking)");
        setMicState("muted");
      }
      if (msg.type === "agent.done") {
        agentSpeakingRef.current = false;
        setPillState({ state: "live", label: "LIVE" });
        setMicStatus(micOnRef.current ? "Mic active" : "Mic off");
        setMicState(micOnRef.current ? "on" : "off");
      }
      if (msg.type === "agent.interrupted") {
        agentSpeakingRef.current = false;
        audioQRef.current = [];
        nextPlayRef.current = 0;
        playingRef.current = false;
        if (playCtxRef.current) {
          try { void playCtxRef.current.close(); } catch { }
          playCtxRef.current = null;
        }
        finaliseAgent();
        setPillState({ state: "live", label: "LIVE" });
        setMicStatus(micOnRef.current ? "Mic active" : "Mic off");
        setMicState(micOnRef.current ? "on" : "off");
        addLog("Agent interrupted", "w");
      }
      if (msg.type === "metrics.latency") {
        const turn: LatencyTurn = {
          turn: msg.turn as number,
          kind: (msg.kind as "greeting" | "response") ?? "response",
          ms: msg.ms as number,
          at: (msg.at as string) ?? new Date().toISOString(),
        };
        setLatencies((prev) => [...prev, turn]);
        addLog(`Latency (${turn.kind}): ${turn.ms}ms`, turn.ms < 800 ? "s" : turn.ms < 1500 ? "w" : "e");
      }
      if (msg.type === "transcript.agent") appendAgent((msg.delta as string) || "");
      if (msg.type === "transcript.agent.done") finaliseAgent();
      if (msg.type === "transcript.user") {
        audioQRef.current = [];
        nextPlayRef.current = 0;
        playingRef.current = false;
        addMsg("user", msg.text as string);
      }
      if (msg.type === "tool.called") {
        addMsg("tool", `🔧 ${msg.name}  ${JSON.stringify(msg.args)}`);
        addLog(`Tool: ${msg.name}`, "w");
      }
      if (msg.type === "tool.result") addMsg("tool-result", `✅ ${msg.name}  ${JSON.stringify(msg.result)}`);
      if (msg.type === "system") addMsg("sys", msg.message as string);
      if (msg.type === "error") {
        addMsg("sys", `⚠ ${msg.message}`);
        addLog(msg.message as string, "e");
      }
    };

    ws.onclose = (e) => {
      addLog(`Closed — code: ${e.code}`, "w");
      sessionReadyRef.current = false;
      agentSpeakingRef.current = false;
      setCallEnded(true);
      cleanup();
    };

    ws.onerror = () => {
      addLog("Cannot reach backend — is it running at " + BACKEND_WS + "?", "e");
      setPillState({ state: "error", label: "Error" });
      addMsg("sys", "⚠ Cannot reach backend. Check BACKEND_WS in this file.");
    };
  }, [phone, resolvedPhone, addLog, addMsg, startMic, appendAgent, finaliseAgent, cleanup, playNext]);

  const disconnect = useCallback(() => {
    sessionReadyRef.current = false;
    agentSpeakingRef.current = false;
    setCallEnded(true);
    wsRef.current?.close();
    cleanup();
    addMsg("sys", "Disconnected.");
  }, [cleanup, addMsg]);

  // mic button classes
  const micBtnClass = (() => {
    const base =
      "w-11 h-11 rounded-full border flex items-center justify-center cursor-pointer text-xl flex-shrink-0 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed";
    if (micState === "on") return `${base} bg-[#7c6aff]/10 text-[#7c6aff] border-[#7c6aff]/50 animate-[ring_1.5s_infinite]`;
    if (micState === "muted") return `${base} bg-destructive/10 text-destructive border-destructive/50`;
    return `${base} bg-accent text-muted-foreground border-border`;
  })();

  return (
    <div className="flex flex-col gap-6">
      {/* keyframes injected via style tag */}
      <style>{`
        @keyframes up { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ring { 0%,100%{box-shadow:0 0 0 0 rgba(124,106,255,.3)} 50%{box-shadow:0 0 0 10px rgba(124,106,255,0)} }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">AI Agent Monitor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Browser → Backend → Gemini Live</p>
        </div>
        <Pill state={pill.state} label={pill.label} />
      </div>

      {/* ── 1 — Lead Info ───────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          1 — Lead Info
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] text-muted-foreground uppercase tracking-[.06em] font-medium">Phone Number *</label>
            <PhoneInput
              country={'in'}
              value={phone}
              onChange={(value) => setPhone(value)}
              enableSearch={true}
              disableSearchIcon={true}
              countryCodeEditable={false}
              placeholder="Enter phone number"
              containerClass="!w-full"
              inputClass="!w-full !h-10 sm:!h-9 !text-sm"
              buttonClass="!border-r-0"
              dropdownClass=""
            />
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] text-muted-foreground uppercase tracking-[.06em] font-medium">Lead Name</label>
            <input
              type="text"
              placeholder="Ramesh Kumar"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              className="h-10 sm:h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] text-muted-foreground uppercase tracking-[.06em] font-medium">Project (name from DB)</label>
            <input
              type="text"
              placeholder="Shree Kunj Greens"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="h-10 sm:h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] text-muted-foreground uppercase tracking-[.06em] font-medium">Budget</label>
            <input
              type="text"
              placeholder="50 Lakhs"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="h-10 sm:h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5 w-full md:col-span-2">
            <label className="text-[11px] text-muted-foreground uppercase tracking-[.06em] font-medium">Lead Source</label>
            <input
              type="text"
              placeholder="Instagram Ads"
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
              className="h-10 sm:h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <button
            onClick={setupLead}
            disabled={resolving}
            className="h-9 px-4 bg-primary text-primary-foreground font-semibold rounded-md text-xs hover:bg-primary/95 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {resolving ? "Resolving..." : "Resolve Lead"}
          </button>
          {projectBadge.type !== "none" && (
            <div
              className={`text-xs px-2.5 py-1 rounded-md border font-medium ${
                projectBadge.type === "success"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                  : "bg-amber-500/10 text-amber-500 border-amber-500/25"
              }`}
            >
              {projectBadge.text}
            </div>
          )}
        </div>
      </div>

      {/* ── 2 — Session ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          2 — Session
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={connect}
            disabled={connectDisabled}
            className="h-9 px-4 bg-emerald-600 text-white font-semibold rounded-md text-xs hover:bg-emerald-500 transition-colors disabled:opacity-35 disabled:cursor-not-allowed w-full sm:w-auto flex items-center justify-center gap-1.5"
          >
            ▶ Start Session
          </button>
          <button
            onClick={disconnect}
            disabled={disconnectDisabled}
            className="h-9 px-4 bg-transparent text-destructive border border-destructive/50 hover:bg-destructive/10 font-semibold rounded-md text-xs transition-colors disabled:opacity-35 disabled:cursor-not-allowed w-full sm:w-auto flex items-center justify-center gap-1.5"
          >
            ■ End
          </button>
          <span className="hidden sm:inline text-border">|</span>
          <span className="text-xs text-muted-foreground">{sessionInfo}</span>
        </div>
      </div>

      {/* ── Chat ────────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg flex flex-col">
        {/* chat header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Conversation</h2>
          <button
            onClick={clearChat}
            className="px-3 py-1 text-xs border border-border bg-transparent text-muted-foreground rounded-md cursor-pointer hover:bg-accent hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>

        {/* messages */}
        <div
          ref={msgsRef}
          className="overflow-y-auto px-5 py-5 flex flex-col gap-3 min-h-[380px] max-h-[500px]"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center text-muted-foreground text-sm p-12">
              Set up a lead and start a session to begin
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} msg={m} />)
          )}
        </div>

        {/* mic bar */}
        <div className="px-5 py-4 border-t border-border flex items-center gap-4">
          <button
            onClick={toggleMic}
            disabled={micDisabled}
            className={micBtnClass}
          >
            {micState === "on" ? "🔴" : "🎤"}
          </button>
          <canvas
            ref={canvasRef}
            id="wave"
            className="flex-1 h-9 rounded-md bg-background border border-border"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[120px]">{micStatus}</span>
        </div>
      </div>

      {/* ── Post-call Report ────────────────────────────────────────────── */}
      {callEnded && latencies.length > 0 && <LatencyReport turns={latencies} />}

      {/* ── AI Latency Analyzer ─────────────────────────────────────────── */}
      <LatencyAnalyzer turns={latencies} />

      {/* ── Event Log ───────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-5 py-3 border-b border-border flex justify-between items-center">
          <h2 className="text-sm font-semibold text-foreground">Event Log</h2>
          <button
            onClick={() => setLogs([])}
            className="px-3 py-1 text-xs border border-border bg-transparent text-muted-foreground rounded-md cursor-pointer hover:bg-accent hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
        <div
          ref={logBodyRef}
          className="font-mono text-[11px] px-5 py-3 max-h-[120px] overflow-y-auto leading-[1.8]"
        >
          {logs.map((l) => <LogLine key={l.id} entry={l} />)}
        </div>
      </div>
    </div>
  );
}
