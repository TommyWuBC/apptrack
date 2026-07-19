import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a1411",
          900: "#0f1f1a",
          800: "#163028",
          700: "#1e3d33",
          600: "#2a5245",
        },
        moss: {
          400: "#8fbc8f",
          500: "#6fa86f",
          600: "#4f8a4f",
        },
        citrus: {
          300: "#d4e89a",
          400: "#b8d962",
          500: "#9bc43a",
        },
        parchment: {
          50: "#f4f6f2",
          100: "#e8ece4",
          200: "#d3dbc9",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        display: ['"IBM Plex Sans"', "ui-sans-serif", "sans-serif"],
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgba(15,31,26,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,31,26,0.06) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "24px 24px",
      },
    },
  },
  plugins: [],
} satisfies Config;
