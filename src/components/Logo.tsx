import { Link } from "react-router-dom";
import logoAsset from "@/assets/abr-logo.png.asset.json";

interface LogoProps {
  variant?: "default" | "light";
  className?: string;
}

export const Logo = ({ variant = "default", className = "" }: LogoProps) => {
  return (
    <Link
      to="/"
      className={`inline-flex items-center ${className}`}
      aria-label="Atulya Bharat Run home"
    >
      <img
        src={logoAsset.url}
        alt="Atulya Bharat Run"
        loading="eager"
        // @ts-expect-error fetchpriority is valid HTML
        fetchpriority="high"
        className={`h-8 md:h-10 w-auto select-none ${
          variant === "light" ? "brightness-0 invert" : ""
        }`}
      />
    </Link>
  );
};
