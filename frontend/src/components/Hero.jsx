import React from "react";

export default function Hero() {
  return (
    <section style={{
      minHeight: "calc(100vh - 75px)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "20px 24px"
    }}>
      <h1 style={{
        fontSize: "clamp(3.2rem, 9vw, 6.5rem)",
        fontWeight: "800",
        letterSpacing: "-0.035em",
        lineHeight: "1.05",
        fontFamily: "var(--font-display)",
      }}>
        <span className="gradient-accent">Dormammu Loop</span>
      </h1>
    </section>
  );
}
