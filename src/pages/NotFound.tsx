import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home, Compass } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  useEffect(() => {
    console.error("404: route not found:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <SEO title="Page not found — Atulya Bharat Run" />
      <section className="abr-container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <p className="font-display text-7xl md:text-8xl font-bold text-primary">404</p>
        <h1 className="mt-4 font-display text-3xl md:text-4xl text-navy">Page not found</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/">
              <Home className="h-4 w-4" /> Back to Home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/challenges">
              <Compass className="h-4 w-4" /> Browse Challenges
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default NotFound;
