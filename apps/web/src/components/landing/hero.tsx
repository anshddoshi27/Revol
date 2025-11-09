"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { landingContent } from "@/data/landing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export function LandingHero() {
  const { hero } = landingContent;

  return (
    <section className="relative isolate flex min-h-screen items-center justify-center px-6 py-24 sm:px-12">
      <div className="absolute inset-x-0 top-12 flex items-center justify-center">
        <motion.div
          className="h-40 w-40 rounded-full bg-primary/30 blur-3xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 0.3, duration: 1.6 }}
        />
      </div>

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
        <motion.span
          className="text-sm uppercase tracking-[0.4em] text-white/50"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1, duration: 0.7 }}
        >
          Booking Reimagined
        </motion.span>

        <motion.h1
          className={cn(
            "mt-4 text-7xl font-light tracking-tight sm:text-8xl",
            "text-gradient font-display"
          )}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2, duration: 0.7 }}
        >
          {hero.title}
        </motion.h1>

        <motion.p
          className="mt-10 max-w-xl text-lg leading-relaxed text-white/70 sm:text-xl"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.3, duration: 0.7 }}
        >
          {hero.subtitle}
        </motion.p>

        <motion.div
          className="mt-12 flex flex-col gap-4 sm:flex-row"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.45, duration: 0.7 }}
        >
          <Button asChild className="button-glow text-base sm:text-lg">
            <Link href={hero.primaryAction.href}>
              <span>{hero.primaryAction.label}</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="border-white/10 bg-transparent text-base text-white/70 backdrop-blur-sm transition hover:border-white/30 hover:text-white sm:text-lg"
          >
            <Link href={hero.secondaryAction.href}>
              {hero.secondaryAction.label}
            </Link>
          </Button>
        </motion.div>

        <motion.div
          className="mt-10 flex flex-col items-center gap-4 text-sm text-white/60 sm:flex-row sm:text-left"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.6, duration: 0.7 }}
        >
          <span className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/60">
            Manual capture by design
          </span>
          <p className="max-w-lg text-sm text-white/70">
            Cards are saved during checkout—money moves only when you press Completed, No-Show,
            Cancelled, or Refund in the admin. The UI makes that rule impossible to miss.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

