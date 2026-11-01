import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, LifeBuoy, LockKeyhole, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { roleHome, useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email address."); return; }
    if (!password) { setError("Enter your password."); return; }
    setBusy(true);
    try {
      const user = await login(email.trim().toLowerCase(), password);
      const next = params.get("next");
      const dest = next && next.startsWith(roleHome(user.role)) ? next : roleHome(user.role);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Is the backend running?");
    } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-14 sm:px-6">
      <Card className="shadow-lift">
        <CardHeader className="text-center">
          <span className="mx-auto w-fit rounded-xl bg-red-600 p-2.5 text-white"><LifeBuoy className="h-6 w-6" aria-hidden /></span>
          <CardTitle className="mt-2 text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your ResQFlow account. Your session is a secure, HTTP-only cookie issued by the backend.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" className="pl-9 pr-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">No account yet? <Link to="/register" className="font-semibold text-red-700 hover:underline">Create one</Link></p>
          <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-center text-xs text-muted-foreground">Local demo accounts are listed in the project README (seeded accounts only — there is no default admin).</p>
        </CardContent>
      </Card>
    </div>
  );
}
