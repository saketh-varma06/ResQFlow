import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const AREAS = ["North District", "South District", "East District", "West District", "Central District"];
export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "", area: "", address: "", bloodGroup: "", medicalNotes: "" });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name ?? "", phone: user.phone ?? "", area: user.area ?? AREAS[0], address: user.address ?? "", bloodGroup: (user as { bloodGroup?: string }).bloodGroup ?? "", medicalNotes: (user as { medicalNotes?: string }).medicalNotes ?? "" });
  }, [user]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(""); setMsg(""); setBusy(true);
    try {
      await api("/api/users/me", { method: "PATCH", body: JSON.stringify({ name: form.name.trim(), phone: form.phone.trim() || null, area: form.area, address: form.address.trim() || null, bloodGroup: form.bloodGroup.trim() || null, medicalNotes: form.medicalNotes.trim() || null }) });
      await refresh();
      setMsg("Profile saved to the backend.");
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not save your profile."); }
    finally { setBusy(false); }
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setError(""); setMsg("");
    if (pw.next.length < 8) { setError("New password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      await api("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }) });
      setPw({ current: "", next: "" });
      setMsg("Password changed. All other sessions were signed out for your security.");
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not change the password."); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Profile" description="Your real account details, stored by the backend." />
      {msg && <p role="status" className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{msg}</p>}
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Account details</CardTitle></CardHeader><CardContent>
          <form onSubmit={save} className="space-y-4">
            <p className="text-sm text-muted-foreground">Email: <strong className="text-foreground">{user?.email}</strong> · Role: <strong className="text-foreground">{user?.role}</strong> (email and role cannot be changed here)</p>
            <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" value={form.name} onChange={set("name")} required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" value={form.phone} onChange={set("phone")} /></div>
              <div className="space-y-1.5"><Label htmlFor="area">District</Label><Select id="area" value={form.area} onChange={set("area")}>{AREAS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="address">Address</Label><Input id="address" value={form.address} onChange={set("address")} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="bloodGroup">Blood group</Label><Input id="bloodGroup" value={form.bloodGroup} onChange={set("bloodGroup")} placeholder="e.g. O+" /></div>
              <div className="space-y-1.5"><Label htmlFor="medicalNotes">Medical notes</Label><Input id="medicalNotes" value={form.medicalNotes} onChange={set("medicalNotes")} placeholder="Allergies, conditions…" /></div>
            </div>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Change password</CardTitle></CardHeader><CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="current">Current password</Label><Input id="current" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} required /></div>
            <div className="space-y-1.5"><Label htmlFor="next">New password</Label><Input id="next" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} required /></div>
            <p className="text-xs text-muted-foreground">Changing your password signs out every other session immediately (server-side session invalidation).</p>
            <Button type="submit" variant="outline" disabled={busy}>Change password</Button>
          </form>
        </CardContent></Card>
      </div>
    </div>
  );
}
