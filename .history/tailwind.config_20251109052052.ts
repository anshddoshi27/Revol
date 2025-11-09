import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.5rem",
        sm: "2rem",
        lg: "3rem",
        xl: "4rem",
        "2xl": "5rem"
      }
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: "#3B82F6",
          foreground: "#0F172A"
        },
        surface: {
          DEFAULT: "#0A0F1D",
          accent: "#111931",
          muted: "#1B2545"
        }
      },
      fontFamily: {
        display: ["var(--font-sora)", ...fontFamily.sans],
        sans: ["var(--font-inter)", ...fontFamily.sans]
      },
      backgroundImage: {
        "landing-radial":
          "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.25), transparent 60%), radial-gradient(circle at 80% 10%, rgba(147,51,234,0.2), transparent 55%), radial-gradient(circle at 50% 75%, rgba(236,72,153,0.25), transparent 60%)"
      },
      boxShadow: {
        "glow-primary": "0 20px 60px rgba(59,130,246,0.35)"
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0px)" }
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.7", filter: "blur(0px)" },
          "50%": { opacity: "1", filter: "blur(2px)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.6s ease forwards",
        "pulse-glow": "pulse-glow 6s ease-in-out infinite"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;

