"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { heroHighlights, landingStats } from "@/mock/marketing";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pb-24 pt-40">
      <div className="pointer-events-none absolute inset-0 landing-backdrop opacity-80" />
      <div className="absolute inset-x-0 top-48 flex justify-center blur-accent opacity-40">
        <div className="h-64 w-[640px] rounded-full bg-brand/60" />
      </div>
      <div className="container relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 shadow-lg backdrop-blur"
        >
          <Sparkles className="h-4 w-4 text-brand" />
          <span>Next-generation booking & payments, on your terms.</span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-display text-6xl font-semibold tracking-tight md:text-7xl"
        >
          Tithi
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 max-w-2xl text-lg text-white/70 md:text-xl"
        >
          Transform your booking process with our revolutionary platform.
          Capture cards up front, charge when it counts, and keep every
          workflow aligned from onboarding to payouts.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button asChild size="lg">
            <Link href="#join">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Link href="#signin" className="text-sm font-medium text-white/70 hover:text-white">
            Sign In
          </Link>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-16 grid gap-6 text-left sm:grid-cols-3"
        >
          {landingStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-inner backdrop-blur"
            >
              <p className="text-3xl font-semibold text-white">{stat.value}</p>
              <p className="mt-2 text-sm text-white/60">{stat.label}</p>
            </div>
          ))}
        </motion.div>
        <motion.ul
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-3 text-sm text-white/60"
        >
          {heroHighlights.map((item) => (
            <li
              key={item}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2"
            >
              {item}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

