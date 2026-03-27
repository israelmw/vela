import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const svg = readFileSync(path.join(__dirname, "icon.svg"), "utf8");
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07090c",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL rasterized by ImageResponse */}
        <img src={src} width={132} height={152} alt="" />
      </div>
    ),
    { ...size },
  );
}
