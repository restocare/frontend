import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { META_GRAPH_API_VERSION, isMetaEventName } from "@/lib/meta-shared";

/**
 * Meta Conversions API relay. The browser (lib/meta.ts) posts each event
 * here with the same event_id it gave the pixel; Meta deduplicates the pair.
 * PII is hashed here, server-side, before it leaves our infrastructure.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN ?? "";
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE ?? "";

const MAX_BODY_BYTES = 8 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;
const MAX_CUSTOM_KEYS = 20;
const MAX_STRING = 200;

type Json = Record<string, unknown>;

// Best-effort per-instance limiter (serverless instances each keep their own).
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (hits.size > 5000) {
      for (const [key, value] of hits) if (value.resetAt <= now) hits.delete(key);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normaliseEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

/** Indian numbers: digits only, country code 91, no plus sign. */
function normalisePhone(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0091")) digits = digits.slice(4);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : undefined;
}

function normaliseName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim().toLowerCase().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= MAX_STRING ? name : undefined;
}

function cleanString(value: unknown, max = MAX_STRING): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;
}

/** Only plain, bounded values reach Meta's custom_data. */
function cleanCustomData(value: unknown): Json | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Json = {};
  let keys = 0;
  for (const [key, raw] of Object.entries(value as Json)) {
    if (keys >= MAX_CUSTOM_KEYS || !/^[a-z0-9_]{1,40}$/i.test(key)) continue;
    if (typeof raw === "string") {
      if (raw.length <= MAX_STRING) out[key] = raw;
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = raw;
    } else if (typeof raw === "boolean") {
      out[key] = raw;
    } else if (Array.isArray(raw) && raw.length <= 50) {
      const items = raw
        .filter((v) => typeof v === "string" || typeof v === "number")
        .map((v) => String(v).slice(0, MAX_STRING));
      if (items.length) out[key] = items;
    } else {
      continue;
    }
    keys += 1;
  }
  return Object.keys(out).length ? out : undefined;
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // sendBeacon / keepalive requests may omit it.
  // Compare against the host the browser addressed (behind Vercel / a proxy,
  // nextUrl.host can be the internal hostname, not the public one).
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    request.headers.get("host") ||
    request.nextUrl.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    // Not configured: tell the browser nothing is wrong on its side.
    return NextResponse.json({ ok: false, reason: "disabled" });
  }
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const ip = clientIp(request);
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  }

  let body: Json;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, reason: "too_large" }, { status: 413 });
    }
    body = JSON.parse(text) as Json;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, reason: "invalid_body" }, { status: 400 });
  }

  const eventName = body.event_name;
  const eventId = cleanString(body.event_id, 64);
  const eventSourceUrl = cleanString(body.event_source_url, 2048);
  if (!isMetaEventName(eventName) || !eventId || !eventSourceUrl) {
    return NextResponse.json({ ok: false, reason: "invalid_event" }, { status: 400 });
  }
  // Trust the browser's time only when it is plausible; Meta rejects stale events.
  const now = Math.floor(Date.now() / 1000);
  const sentTime = typeof body.event_time === "number" ? Math.floor(body.event_time) : now;
  const eventTime = Math.abs(now - sentTime) <= 60 * 60 ? sentTime : now;

  const rawUser = (body.user_data && typeof body.user_data === "object" ? body.user_data : {}) as Json;
  const email = normaliseEmail(rawUser.email);
  const phone = normalisePhone(rawUser.phone);
  const firstName = normaliseName(rawUser.firstName);
  const lastName = normaliseName(rawUser.lastName);

  const userData: Json = {
    client_ip_address: ip !== "unknown" ? ip : undefined,
    client_user_agent: request.headers.get("user-agent") ?? undefined,
    fbp: cleanString(body.fbp),
    fbc: cleanString(body.fbc, 512),
    em: email ? [sha256(email)] : undefined,
    ph: phone ? [sha256(phone)] : undefined,
    fn: firstName ? [sha256(firstName)] : undefined,
    ln: lastName ? [sha256(lastName)] : undefined,
  };
  for (const key of Object.keys(userData)) if (userData[key] === undefined) delete userData[key];

  const event: Json = {
    event_name: eventName,
    event_time: eventTime,
    event_id: eventId,
    action_source: "website",
    event_source_url: eventSourceUrl,
    user_data: userData,
  };
  const customData = cleanCustomData(body.custom_data);
  if (customData) event.custom_data = customData;

  const payload: Json = { data: [event] };
  if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

  try {
    const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${PIXEL_ID}/events`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, access_token: ACCESS_TOKEN }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // The token never appears in Meta's error body, but keep the log terse anyway.
      console.error(`[meta-capi] ${eventName} rejected (${res.status}): ${detail.slice(0, 500)}`);
    }
  } catch (error) {
    console.error("[meta-capi] request failed:", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({ ok: true });
}
