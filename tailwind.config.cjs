/**
 * Tailwind v4 — theme source of truth is `src/app/globals.css` (`@theme inline`).
 * This file mirrors tokens for tooling / docs / editor hints.
 * @see src/app/globals.css
 */
module.exports = {
  theme: {
    extend: {
      container: {
        center: true,
        padding: "1.5rem",
        screens: {
          xl: "1200px",
        },
      },
      colors: {
        // Brand navy is the unified primary + interaction accent (heritage navy+gold).
        primary: "#0B1F4D",
        secondary: "#0B1F4D",
        brand: "#0B1F4D",
        "brand-strong": "#081636",
        "brand-soft": "#EEF1F7",
        // Gold accent — the premium / certification signal.
        accent: "#9A7B2E",
        "accent-strong": "#826724",
        "accent-bright": "#C9A227",
        "accent-soft": "#F7F1E0",
        canvas: "#F8FAFC",
        muted: "#64748B",
        border: "#E2E8F0",
        background: "#F8FAFC",
        surface: "#FFFFFF",
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",
        "blue-soft": "#DBEAFE",
        "purple-soft": "#EDE9FE",
        "green-soft": "#DCFCE7",
        "orange-soft": "#FFEDD5",
        "gold-soft": "#F7F1E0",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      // Tinted, layered shadows (cool navy undertone) — mirrors globals.css @theme.
      boxShadow: {
        sm: "0 1px 1px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.06)",
        md: "0 2px 4px rgba(15,23,42,0.05), 0 6px 16px rgba(15,23,42,0.08)",
        lg: "0 4px 8px rgba(15,23,42,0.06), 0 16px 32px rgba(15,23,42,0.12)",
        xl: "0 8px 16px rgba(15,23,42,0.08), 0 28px 56px rgba(15,23,42,0.16)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      fontSize: {
        hero: ["44px", { lineHeight: "52px", fontWeight: "600" }],
        h1: ["32px", { lineHeight: "40px", fontWeight: "600" }],
        h2: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "26px" }],
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
}
