import { Link } from "react-router-dom";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="rounded-2xl bg-red-600 p-3 text-white"><LifeBuoy className="h-8 w-8" aria-hidden /></span>
      <h1 className="mt-5 font-display text-4xl font-extrabold">404 — page not found</h1>
      <p className="mt-2 max-w-md text-muted-foreground">This route doesn't exist. If you were following a link, it may belong to a later phase of ResQFlow.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild><Link to="/">Go home</Link></Button>
        <Button asChild variant="outline"><Link to="/citizen">Citizen dashboard</Link></Button>
        <Button asChild variant="outline"><Link to="/citizen/sos">SOS</Link></Button>
      </div>
    </div>
  );
}
