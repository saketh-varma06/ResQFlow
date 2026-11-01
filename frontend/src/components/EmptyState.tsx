import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <span className="rounded-full bg-muted p-3"><Inbox className="h-6 w-6 text-muted-foreground" aria-hidden /></span>
        <p className="font-display font-semibold">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
        {action}
      </CardContent>
    </Card>
  );
}
export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}><CardContent className="p-5"><div className="h-3 w-24 animate-pulse rounded bg-muted" /><div className="mt-3 h-8 w-16 animate-pulse rounded bg-muted" /><div className="mt-3 h-3 w-32 animate-pulse rounded bg-muted" /></CardContent></Card>
      ))}
    </div>
  );
}
