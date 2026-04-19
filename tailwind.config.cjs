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
        primary: "#0F172A",
        secondary: "#6366F1",
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
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.05)",
        md: "0 4px 12px rgba(0,0,0,0.08)",
        lg: "0 10px 25px rgba(0,0,0,0.12)",
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
