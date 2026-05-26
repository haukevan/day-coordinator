import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3">
            <Logo size="sm" />
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Real-time coordination for your most important day.
            </p>
          </div>

          <div className="flex gap-12 text-sm">
            <div className="flex flex-col gap-3">
              <p className="font-semibold text-foreground">Product</p>
              <Link
                href="#features"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <p className="font-semibold text-foreground">Legal</p>
              <Link
                href="/privacy"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Day Coordinator. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
