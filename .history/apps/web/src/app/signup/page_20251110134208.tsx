import Link from "next/link";

import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16 sm:px-10">
      <header className="absolute left-1/2 top-10 w-full max-w-5xl -translate-x-1/2 px-6 sm:px-10">
        <nav className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5/50 px-6 py-4 backdrop-blur-lg">
          <Link href="/" className="font-display text-2xl text-white">
            Tithi
          </Link>
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            Already have an account?
          </Link>
        </nav>
      </header>

      <SignupForm />

      <footer className="mt-12 text-center text-xs text-white/40">
        <p>© {new Date().getFullYear()} Tithi Corporation. All rights reserved.</p>
      </footer>
    </main>
  );
}



