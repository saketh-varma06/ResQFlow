import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, LifeBuoy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { roleHome, useAuth, type Role } from "@/context/AuthContext";

const AREAS = ["North District", "South District", "East District", "West District", "Central District"];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "", role: "CITIZEN" as Role, area: "North District", address: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingMsg, setPendingMsg] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.name.trim().length < 2) { setError("Enter your full name."); return; }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) { setError("Enter a valid email address."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const result = await register({ name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() || undefined, password: form.password, role: form.role, area: form.area, address: form.address.trim() || undefined });
      if (result.pending) { setPendingMsg(result.message ?? "Account created and pending approval."); return; }
      navigate(roleHome(result.user.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Is the backend running?");
    } finally { setBusy(false); }
  }

  if (pendingMsg) {
    return (
      <div className="mx-auto flex max-w-md flex-col px-4 py-14 sm:px-6">
        <Card className="shadow-lift"><CardContent className="py-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
          <h1 className="mt-3 font-display text-xl font-bold">Account created — pending approval</h1>
          <p className="mt-2 text-sm text-muted-foreground">{pendingMsg} Responder and administrator accounts are never activated automatically; an existing administrator must approve yours before you can sign in.</p>
          <Button asChild className="mt-5"><Link to="/login">Go to sign in</Link></Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-14 sm:px-6">
      <Card className="shadow-lift">
        <CardHeader className="text-center">
          <span className="mx-auto w-fit rounded-xl bg-red-600 p-2.5 text-white"><LifeBuoy className="h-6 w-6" aria-hidden /></span>
          <CardTitle className="mt-2 text-2xl">Create your account</CardTitle>
          <CardDescription>Citizen accounts activate immediately. Responder and administrator accounts require administrator approval.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" autoComplete="name" value={form.name} onChange={set("name")} required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required /></div>
              <div className="space-y-1.5"><Label htmlFor="phone">Phone (optional)</Label><Input id="phone" autoComplete="tel" value={form.phone} onChange={set("phone")} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="role">Account type</Label>
                <Select id="role" value={form.role} onChange={set("role")}><option value="CITIZEN">Citizen</option><option value="RESPONDER">Responder (needs approval)</option><option value="ADMIN">Administrator (needs approval)</option></Select></div>
              <div className="space-y-1.5"><Label htmlFor="area">District</Label>
                <Select id="area" value={form.area} onChange={set("area")}>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="address">Address (optional)</Label><Input id="address" autoComplete="street-address" value={form.address} onChange={set("address")} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required /></div>
              <div className="space-y-1.5"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} required /></div>
            </div>
            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">Already registered? <Link to="/login" className="font-semibold text-red-700 hover:underline">Sign in</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
