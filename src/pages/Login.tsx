import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Logo } from "@/components/Logo";
import { landingPathForRoles } from "@/lib/auth/postLoginRedirect";
import { useAuth } from "@/hooks/useAuth";
import { monitoring } from "@/lib/monitoring";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { initialized, rolesLoading, user, isAdmin } = useAuth();
  const hasRedirected = useRef(false);
  const submittedAt = useRef<number | null>(null);

  // Effect-based redirect — single-shot, prevents StrictMode double-fire and
  // race conditions between Login submit and AuthBootstrap.
  useEffect(() => {
    if (hasRedirected.current) return;
    if (!initialized || !user) return;
    // Wait for roles so admin destination resolves correctly.
    if (rolesLoading) return;

    hasRedirected.current = true;
    const dest = landingPathForRoles(isAdmin, searchParams.get("redirect"));
    monitoring.track("redirect_started", { dest });
    if (submittedAt.current) {
      monitoring.track("redirect_completed", {
        time_to_redirect_ms: Date.now() - submittedAt.current,
      });
    }
    navigate(dest, { replace: true });
  }, [initialized, rolesLoading, user, isAdmin, navigate, searchParams]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast({ title: "Supabase not connected", description: "Connect your Supabase project to enable login.", variant: "destructive" });
      return;
    }
    setLoading(true);
    submittedAt.current = Date.now();
    monitoring.track("login_submitted");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      return;
    }
    monitoring.track("login_success");
    toast({ title: "Welcome back!" });
    // Redirect is handled by the effect once `initialized && user && !rolesLoading`.
    setLoading(false);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Logo />
          <h1 className="font-display text-3xl mt-6">Welcome back</h1>
          <p className="text-muted-foreground mt-2 text-sm">Log in to continue your journey across India.</p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-card p-6 sm:p-8">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput id="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Log in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary font-semibold hover:underline">
              Sign up
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">← Back to home</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
