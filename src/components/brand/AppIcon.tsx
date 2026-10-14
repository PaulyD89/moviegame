/** Shared artwork for generated app icons: a red "M" letter tile. */
export function AppIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0908",
      }}
    >
      <div
        style={{
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: size * 0.14,
          background: "#dc2626",
          border: `${Math.max(2, size * 0.03)}px solid #fbbf24`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: size * 0.5,
          fontWeight: 900,
          fontFamily: "sans-serif",
        }}
      >
        M
      </div>
    </div>
  );
}
