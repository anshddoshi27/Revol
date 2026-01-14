import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
};

export function Logo({ className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2 text-white", className)}>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
        <span className="text-lg font-semibold tracking-wide">Ti</span>
      </span>
      <span className="text-xl font-semibold tracking-tight">Tithi</span>
    </div>
  );
}

