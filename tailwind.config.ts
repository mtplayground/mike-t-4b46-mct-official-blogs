import type { Config } from "tailwindcss";

const ideavibesPalette = {
  white: "#FFFFFF",
  mist: "#F7F3FF",
  aura: "#FFF6E5",
  coral: "#FF5A3C",
  "coral-hover": "#E9482E",
  violet: "#6C5CE7",
  plum: "#2B183F",
  ink: "#161024",
  muted: "#6D6478",
  line: "#E8E1F4",
  "dark-card": "#241631",
  "dark-card-muted": "#C9BCD8",
} as const;

const config: Config = {
  content: [
    "./rust-backend/templates/**/*.html",
    "./rust-backend/src/**/*.rs",
  ],
  theme: {
    extend: {
      colors: {
        ideavibes: ideavibesPalette,
        editorial: {
          white: ideavibesPalette.white,
          cream: ideavibesPalette.aura,
          red: ideavibesPalette.coral,
          "red-hover": ideavibesPalette["coral-hover"],
          ink: ideavibesPalette.ink,
          muted: ideavibesPalette.muted,
          line: ideavibesPalette.line,
          "dark-card": ideavibesPalette["dark-card"],
          "dark-card-muted": ideavibesPalette["dark-card-muted"],
        },
      },
      fontFamily: {
        sans: ["Arial", "Helvetica Neue", "Helvetica", "sans-serif"],
      },
      fontSize: {
        eyebrow: ["0.78rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
        lead: ["1.125rem", { lineHeight: "1.75rem" }],
        "heading-sm": ["1.75rem", { lineHeight: "2.1rem", letterSpacing: "-0.01em" }],
        "heading-md": ["2.5rem", { lineHeight: "2.9rem", letterSpacing: "-0.02em" }],
        "heading-lg": ["4rem", { lineHeight: "4.25rem", letterSpacing: "-0.03em" }],
      },
      borderRadius: {
        button: "999px",
        card: "8px",
      },
      boxShadow: {
        editorial: "0 24px 60px rgb(22 16 36 / 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
