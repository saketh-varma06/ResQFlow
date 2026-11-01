import { cn } from "@/lib/utils";
/** Styled native select — keeps forms accessible and dependency-light inside the shadcn system. */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50", className)} {...props}>{children}</select>
  );
}
