import type { Metadata } from "next";
import { PropsWithChildren } from "react";

import { AppProviders } from "@/components/providers/app-providers";
import { fontDisplay, fontSans } from "@/styles/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "Revol — Transform Your Booking Experience",
  description:
    "Revol modernizes booking operations for service businesses with precise control, seamless scheduling, and Stripe-ready payments.",
  icons: {
    icon: "/icons/favicon.svg"
  },
  openGraph: {
    title: "Revol",
    description:
      "Transform your booking process with our revolutionary platform.",
    url: "https://revol.com",
    siteName: "Revol"
  },
  twitter: {
    card: "summary_large_image",
    title: "Revol",
    description:
      "Transform your booking process with our revolutionary platform."
  }
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
      <body className="relative overflow-x-hidden">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

