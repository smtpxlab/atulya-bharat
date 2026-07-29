import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { LogIn, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";


type Props = {
  /** Where to return after Google OAuth round-trip */
  returnTo: string;
};

export const AuthPanel = ({ returnTo }: Props) => {
  const { user, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Logged in.");
  };




  if (user) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg text-navy">Account</h2>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-success/10 px-4 py-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-foreground">Logged in</p>
            <p className="truncate text-muted-foreground">{user.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="min-h-11"
          >
            Sign out
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <LogIn className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg text-navy">Log in to continue</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Your selections will be preserved.
      </p>

      <form onSubmit={handleEmailLogin} className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ck-email">Email</Label>
          <Input
            id="ck-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-xl min-h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ck-password">Password</Label>
          <PasswordInput
            id="ck-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-xl min-h-11"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-full min-h-11"
        >
          {loading ? "Signing in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-4 text-right text-sm">
        <Link to="/forgot-password" className="font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      </p>


      <p className="mt-4 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          to={`/signup?redirect=${encodeURIComponent(returnTo)}`}
          className="font-semibold text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </section>
  );
};
