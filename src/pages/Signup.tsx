import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { landingPathForRoles } from "@/lib/auth/postLoginRedirect";
import { monitoring } from "@/lib/monitoring";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { initialized, rolesLoading, user, isAdmin } = useAuth();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    if (!initialized || !user || rolesLoading) return;
    hasRedirected.current = true;
    const dest = landingPathForRoles(isAdmin, searchParams.get("redirect"));
    monitoring.track("redirect_started", { dest });
    navigate(dest, { replace: true });
  }, [initialized, rolesLoading, user, isAdmin, navigate, searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast({ title: "Supabase not connected", description: "Connect your Supabase project to enable signup.", variant: "destructive" });
      return;
    }
    const requested = searchParams.get("redirect");
    const target =
      requested && requested.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/admin")
        ? requested
        : "/dashboard";
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${target}`,
        data: { full_name: name, city },
      },
    });
    setLoading(false);

    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      return;
    }

    if (data.session) {
      toast({ title: "Welcome to ABR!" });
      // Redirect handled by effect.
    } else {
      setPendingConfirm(true);
      toast({ title: "Check your email", description: "We sent you a confirmation link to verify your account." });
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Logo />
          <h1 className="font-display text-3xl mt-6">Join the journey</h1>
          <p className="text-muted-foreground mt-2 text-sm">Create your account and start exploring India, one km at a time.</p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-card p-6 sm:p-8">
          {pendingConfirm ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-foreground">Almost there!</p>
              <p className="text-sm text-muted-foreground">
                Open the confirmation link we sent to <strong>{email}</strong> to activate your account.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput id="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Jaipur" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Log in
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

export default Signup;
