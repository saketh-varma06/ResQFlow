import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { LifeBuoy, LogOut, Menu, X, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { roleHome, useAuth } from "@/context/AuthContext";
const links = [{ to: "/", label: "Home", end: true }, { to: "/about", label: "About" }];
export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2 focus:z-50">Skip to content</a>
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-slate-900">
            <span className="rounded-lg bg-red-600 p-1.5 text-white"><LifeBuoy className="h-5 w-5" aria-hidden /></span> ResQFlow
          </Link>
          <nav aria-label="Public" className="ml-6 hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cn("rounded-md px-3 py-2 text-sm font-medium", isActive ? "text-red-700" : "text-slate-600 hover:text-slate-900")}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <span className="mr-1 hidden items-center gap-1.5 text-sm font-semibold text-red-700 lg:flex"><PhoneCall className="h-4 w-4" aria-hidden /> Emergency: 112</span>
            {user ? (<>
              <span className="text-sm font-medium text-slate-600">Signed in as <strong className="text-slate-900">{user.name}</strong></span>
              <Button asChild><Link to={roleHome(user.role)}>Open my dashboard</Link></Button>
              <Button variant="outline" onClick={() => void logout()}><LogOut className="mr-1.5 h-4 w-4" aria-hidden />Sign out</Button>
            </>) : (<>
              <Button asChild variant="outline"><Link to="/login">Sign in</Link></Button>
              <Button asChild><Link to="/register">Create account</Link></Button>
            </>)}
          </div>
          <button className="ml-auto rounded-md p-2 md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {open && (
          <nav aria-label="Public mobile" className="border-t bg-white px-4 py-3 md:hidden">
            {links.map((l) => (<Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block rounded-md px-2 py-2 text-sm font-medium text-slate-700">{l.label}</Link>))}
            <div className="mt-2 flex gap-2"><Button asChild variant="outline" className="flex-1"><Link to="/login">Sign in</Link></Button><Button asChild className="flex-1"><Link to="/register">Create account</Link></Button></div>
          </nav>
        )}
      </header>
      <main id="main"><Outlet /></main>
      <footer className="border-t bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div><p className="flex items-center gap-2 font-display font-bold text-white"><span className="rounded-lg bg-red-600 p-1.5"><LifeBuoy className="h-4 w-4" aria-hidden /></span> ResQFlow</p><p className="mt-3 text-sm text-slate-400">Disaster management and emergency response coordination for citizens, responders and administrators.</p></div>
          <nav aria-label="Footer"><p className="font-semibold text-white">Platform</p><ul className="mt-3 space-y-2 text-sm"><li><Link to="/about" className="hover:text-white">About the platform</Link></li><li><Link to="/citizen/shelters" className="hover:text-white">Find shelters</Link></li><li><Link to="/citizen/alerts" className="hover:text-white">Disaster alerts</Link></li></ul></nav>
          <div><p className="font-semibold text-white">In an emergency</p><p className="mt-3 text-sm text-slate-400">Call your local emergency number <strong className="text-white">112</strong> first. ResQFlow coordinates help — it does not replace emergency services.</p></div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">ResQFlow — live disaster operations. Accounts, data and notifications are real, served by the ResQFlow backend.</div>
      </footer>
    </div>
  );
}
