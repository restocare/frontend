import { ImageResponse } from "next/og";

// Shared between opengraph-image.tsx and twitter-image.tsx. Next.js requires
// each route's `runtime`/`alt`/`size`/`contentType` exports to be literal in
// that file (re-exporting them from a sibling file fails the build), so only
// the actual render logic is shared here.
export const OG_IMAGE_ALT =
  "RestoCare — Restaurant Staff & Kitchen Services, Delhi NCR";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          background: "#0A192F",
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* Orange accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 8,
            height: "100%",
            background: "#E2563B",
          }}
        />

        {/* Top-right geometric accent */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(226, 86, 59, 0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 40,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "rgba(226, 86, 59, 0.05)",
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#E2563B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            🍽️
          </div>
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.5px",
            }}
          >
            RestoCare
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 62,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.05,
            letterSpacing: "-1px",
            maxWidth: 860,
            marginBottom: 24,
          }}
        >
          <div>Restaurant Staff &amp;</div>
          <div>Kitchen Services</div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.65)",
            fontWeight: 400,
            marginBottom: 40,
          }}
        >
          Book by the shift — Chefs, Helpers, Deep Cleaning · Delhi NCR
        </div>

        {/* CTA pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#E2563B",
            borderRadius: 100,
            padding: "14px 32px",
          }}
        >
          <span style={{ fontSize: 20, color: "#ffffff", fontWeight: 600 }}>
            www.restocare.in
          </span>
        </div>
      </div>
    ),
    {
      ...OG_IMAGE_SIZE,
    },
  );
}
