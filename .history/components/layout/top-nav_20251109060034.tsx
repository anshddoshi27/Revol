"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

const navVariants = {
  hidden: { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0 },
};

export function TopNav() {
  return (
    <motion.header
      initial="hidden"
      animate="visible"
      variants={navVariants}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-50 bg-surface/80 backdrop-blur-xl"
    >
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" aria-label="Tithi home" className="hover:opacity-90">
          <Logo />
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href={siteConfig.links.login}
            className="text-sm font-medium text-white/80 transition hover:text-white"
          >
            Sign In
          </Link>
          <Button asChild size="sm">
            <Link href={siteConfig.links.join}>Join Tithi Now</Link>
          </Button>
        </nav>
      </div>
    </motion.header>
  );
}

