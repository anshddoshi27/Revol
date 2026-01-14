export const siteConfig = {
  name: "Tithi",
  description:
    "Transform your booking operations with an intelligent platform built for modern service businesses.",
  url: "https://tithi.com",
  links: {
    join: "#join",
    login: "#signin",
  },
  social: {
    twitter: "https://twitter.com/tithi",
    linkedin: "https://www.linkedin.com/company/tithi",
  },
} as const;

export type SiteConfig = typeof siteConfig;

