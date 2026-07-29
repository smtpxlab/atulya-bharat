import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LayoutDashboard, LogOut, Shield, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const links = [
  { to: "/about", label: "About" },
  { to: "/challenges", label: "Challenges" },
  { to: "/clubs", label: "Clubs" },
  { to: "/blog", label: "Blog" },
  { to: "/gallery", label: "Gallery" },
  { to: "/contact", label: "Contact" },
];

const initialsFrom = (email?: string | null, name?: string | null) => {
  const src = (name || email || "U").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase();
};

export const Navbar = () => {
  const { user, signOut, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const initials = useMemo(
    () =>
      initialsFrom(
        user?.email,
        (user?.user_metadata as { full_name?: string } | undefined)?.full_name,
      ),
    [user?.email, user?.user_metadata],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const transparent = false;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-[250ms] ease-out",
        transparent
          ? "bg-transparent border-transparent"
          : "border-b border-border bg-white/[0.92] backdrop-blur-md shadow-sm",
      )}
    >
      {transparent && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 nav-overlay"
        />
      )}
      <div className="relative abr-container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo />
        </div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-7" aria-label="Main">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "text-sm font-medium transition-colors",
                  transparent
                    ? cn(
                        "text-shadow-nav",
                        isActive ? "text-white" : "text-white/95 hover:text-white",
                      )
                    : isActive
                      ? "text-primary"
                      : "text-navy hover:text-primary",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
            {isAdmin ? (
              <Button asChild className="hidden sm:inline-flex rounded-full">
                <Link to="/admin" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Admin Portal
                </Link>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold ring-offset-background transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  {initials}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            </>
          ) : (
            <Button
              asChild
              className={cn(
                "hidden sm:inline-flex rounded-full",
                transparent && "bg-white text-navy hover:bg-white/90",
              )}
            >
              <Link to="/login">Login / Register</Link>
            </Button>
          )}

          <button
            className={cn(
              "lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors",
              transparent
                ? "text-white hover:bg-white/15"
                : "text-navy hover:bg-muted",
            )}
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile full-screen drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 top-16 z-40 bg-background shadow-lg min-h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="abr-container flex flex-col py-6" aria-label="Mobile">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "py-4 text-lg font-medium border-b border-border",
                    isActive ? "text-primary" : "text-navy",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            {user && isAdmin && (
              <Button asChild className="mt-6 w-full rounded-full" onClick={() => setOpen(false)}>
                <Link to="/admin">Admin Portal</Link>
              </Button>
            )}
            {!user && (
              <Button asChild className="mt-6 w-full rounded-full" onClick={() => setOpen(false)}>
                <Link to="/login">Login / Register</Link>
              </Button>
            )}
          </nav>
        </div>
      )}

    </header>
  );
};
