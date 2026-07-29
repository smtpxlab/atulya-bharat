import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Logo } from "@/components/Logo";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast({
        title: "Backend not connected",
        description: "Password reset is unavailable.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      const msg = error.message || "";
      const rateLimited = /security purposes|rate limit|after \d+ seconds/i.test(msg);
      toast({
        title: rateLimited ? "Please wait a moment" : "Could not send reset email",
        description: rateLimited
          ? "You can request another reset link in a few seconds."
          : msg,
        variant: "destructive",
      });
      if (rateLimited) setCooldown(20);
      return;
    }
    setSent(true);
    setCooldown(20);
    toast({ title: "Check your email", description: "We sent you a password reset link." });
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Logo />
          <h1 className="font-display text-3xl mt-6">Forgot password?</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Enter your email and we'll send you a link to reset it.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-card p-6 sm:p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-foreground">
                If an account exists for <span className="font-semibold">{email}</span>, a reset link is on its way.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Back to login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || cooldown > 0}>
                {loading ? "Sending…" : cooldown > 0 ? `Try again in ${cooldown}s` : "Send reset link"}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/login" className="hover:text-primary">← Back to login</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
