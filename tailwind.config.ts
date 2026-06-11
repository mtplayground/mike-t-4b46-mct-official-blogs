import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        editorial: {
          white: "#FFFFFF",
          cream: "#F7F2EA",
          red: "#E8472B",
          ink: "#181716",
          muted: "#6F6A64",
          line: "#E6DDD2",
          "dark-card": "#1F1C1A",
          "dark-card-muted": "#A8A09A",
        },
      },
      fontFamily: {
        sans: ["Arial", "Helvetica Neue", "Helvetica", "sans-serif"],
        display: ["Georgia", "Times New Roman", "serif"],
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
        editorial: "0 24px 60px rgb(24 23 22 / 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
