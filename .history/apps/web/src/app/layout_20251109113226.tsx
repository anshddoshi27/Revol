import type { Metadata } from "next";
import { PropsWithChildren } from "react";

import { fontDisplay, fontSans } from "@/styles/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "Tithi — Transform Your Booking Experience",
  description:
    "Tithi modernizes booking operations for service businesses with precise control, seamless scheduling, and Stripe-ready payments.",
  icons: {
    icon: "/icons/favicon.svg"
  },
  openGraph: {
    title: "Tithi",
    description:
      "Transform your booking process with our revolutionary platform.",
    url: "https://tithi.com",
    siteName: "Tithi",
    images: [
      {
        url: "/images/og/landing.png",
        width: 1200,
        height: 630,
        alt: "Tithi Booking Platform"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Tithi",
    description:
      "Transform your booking process with our revolutionary platform.",
    images: ["/images/og/landing.png"]
  }
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
      <body className="relative overflow-x-hidden">{children}</body>
    </html>
  );
}

