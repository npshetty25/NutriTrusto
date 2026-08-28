import { ImageResponse } from "next/og";

// Generated at build time rather than shipped as a static asset, so the card
// can never drift from the product's own palette. 1200x630 is the size every
// unfurler crops to.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Nutri-Trust — scan packaged food, track expiry, cook it before it spoils";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#e9ebf1",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "9px",
              background: "#30a46c",
            }}
          />
          <div
            style={{
              fontSize: "26px",
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "#4a5159",
            }}
          >
            NUTRI-TRUST
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "74px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "#111111",
              maxWidth: "900px",
            }}
          >
            Use it before you lose it.
          </div>
          <div
            style={{
              marginTop: "26px",
              fontSize: "31px",
              lineHeight: 1.35,
              color: "#4a5159",
              maxWidth: "880px",
            }}
          >
            Scan packaged food, track what is already on your shelf, and cook it
            before it spoils. Built for Indian kitchens.
          </div>
        </div>

        <div style={{ display: "flex", gap: "14px" }}>
          {["Barcode scanning", "Expiry tracking", "Indian recipes"].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                fontSize: "23px",
                fontWeight: 600,
                color: "#10633c",
                background: "rgba(48,164,108,0.15)",
                padding: "12px 22px",
                borderRadius: "999px",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
