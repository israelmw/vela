import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt =
  "Vela — a control plane for governed, multi-channel AI agents";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

const interLatin600 =
  "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.2.5/files/inter-latin-600-normal.woff";
const interLatin700 =
  "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.2.5/files/inter-latin-700-normal.woff";

export default async function OpenGraphImage() {
  const svg = readFileSync(
    path.join(process.cwd(), "public", "vela-mark.svg"),
    "utf8",
  );
  const markSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  let fonts: {
    name: string;
    data: ArrayBuffer;
    style: "normal";
    weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  }[] = [];

  try {
    const [data600, data700] = await Promise.all([
      fetch(interLatin600).then((r) => r.arrayBuffer()),
      fetch(interLatin700).then((r) => r.arrayBuffer()),
    ]);
    fonts = [
      { name: "Inter", data: data600, weight: 600, style: "normal" },
      { name: "Inter", data: data700, weight: 700, style: "normal" },
    ];
  } catch {
    // Satori falls back if fonts fail to load
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#07090c",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 72,
            bottom: 72,
            width: 5,
            background: "#52a7ff",
            borderRadius: 3,
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL rasterized by ImageResponse */}
        <img
          src={markSrc}
          width={520}
          height={600}
          alt=""
          style={{
            position: "absolute",
            right: -36,
            bottom: -80,
            opacity: 0.1,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 56px 56px 72px",
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={markSrc} width={56} height={65} alt="" />
              <span
                style={{
                  fontFamily: "Inter",
                  fontSize: 44,
                  fontWeight: 700,
                  color: "#e8ecf4",
                  letterSpacing: -1,
                }}
              >
                Vela
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                alignItems: "center",
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #1f2635",
                background: "#0a0e16",
                fontFamily: "Inter",
                fontSize: 18,
                fontWeight: 600,
                color: "#52a7ff",
              }}
            >
              Open source · Vercel-first
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                maxWidth: 920,
              }}
            >
              <div
                style={{
                  fontFamily: "Inter",
                  fontSize: 52,
                  fontWeight: 700,
                  lineHeight: 1.12,
                  color: "#e8ecf4",
                  letterSpacing: -1.5,
                }}
              >
                A control plane for governed, multi-channel agents
              </div>
              <div
                style={{
                  fontFamily: "Inter",
                  fontSize: 24,
                  fontWeight: 600,
                  lineHeight: 1.45,
                  color: "#a9b1c4",
                }}
              >
                Cloud-native agent OS — channels, control plane, AI SDK runtime,
                MCP & policy — on Postgres and Vercel.
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontFamily: "Inter",
                fontSize: 22,
                fontWeight: 600,
                color: "#e8ecf4",
              }}
            >
              Star the repo on GitHub — every star helps others find Vela
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                fontFamily: "Inter",
                fontSize: 17,
                fontWeight: 600,
                color: "#6b7385",
              }}
            >
              <span>AI SDK 6</span>
              <span style={{ color: "#1f2635" }}>·</span>
              <span>Chat SDK</span>
              <span style={{ color: "#1f2635" }}>·</span>
              <span>MCP</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fonts.length > 0 ? { fonts } : {}),
    },
  );
}
