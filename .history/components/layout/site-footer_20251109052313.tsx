import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-surface/80">
      <div className="container flex flex-col items-center gap-4 py-10 text-sm text-white/60 md:flex-row md:justify-between">
        <p>&copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link
            href="/privacy"
            className="hover:text-white"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-white"
          >
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}

