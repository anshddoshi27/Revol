export const siteConfig = {
  name: "Tithi",
  description:
    "Transform your booking process with our revolutionary platform tailored for modern service businesses.",
  cta: {
    primary: {
      label: "Get Started",
      href: "/signup"
    },
    secondary: {
      label: "Sign In",
      href: "/login"
    }
  },
  meta: {
    title: "Tithi — Reimagined Booking Platform",
    url: "https://tithi.com",
    ogImage: "/og-image.png"
  }
} as const;

export type SiteConfig = typeof siteConfig;

