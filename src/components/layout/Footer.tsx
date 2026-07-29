import { Link } from "react-router-dom";
import { Instagram, Facebook, Youtube, Mail, Phone, type LucideIcon } from "lucide-react";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { Logo } from "@/components/Logo";
import { socialLinks } from "@/config/socialLinks";

const col = "space-y-1 text-sm";
const heading = "font-display text-lg text-white mb-4";
const linkCls = "block py-2 -my-0.5 text-white/70 hover:text-white transition-colors";

const socialIcons: Record<(typeof socialLinks)[number]["name"], LucideIcon> = {
  Facebook,
  Instagram,
  YouTube: Youtube,
};

export const Footer = () => {
  return (
    <footer className="bg-navy text-white">
      <div className="abr-container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo variant="light" className="h-9" />
            <p className="mt-3 text-sm text-white/70 max-w-xs">
              Explore India. One km at a time.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {socialLinks.map((s) => {
                const Icon = socialIcons[s.name];
                return (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.name}
                    className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>


          <div>
            <div className={heading}>Explore</div>
            <ul className={col}>
              <li><Link to="/about" className={linkCls}>About</Link></li>
              <li><Link to="/challenges" className={linkCls}>Challenges</Link></li>
              <li><Link to="/clubs" className={linkCls}>Clubs</Link></li>
              <li><Link to="/blog" className={linkCls}>Blog</Link></li>
              <li><Link to="/gallery" className={linkCls}>Gallery</Link></li>
              <li><Link to="/contact" className={linkCls}>Contact</Link></li>
            </ul>
          </div>

          <div>
            <div className={heading}>Policies</div>
            <ul className={col}>
              <li><Link to="/terms-and-conditions" className={linkCls}>Terms & Conditions</Link></li>
              <li><Link to="/privacy-policy" className={linkCls}>Privacy Policy</Link></li>
              <li><Link to="/refund-return-policy" className={linkCls}>Refund & Return Policy</Link></li>
            </ul>
            <div className="mt-5 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-white/70">
                <Phone className="h-4 w-4 text-primary" />
                <a href="tel:+919084501008" className={linkCls}>+91 9084501008</a>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <Mail className="h-4 w-4 text-primary" />
                <a href="mailto:info@atulyabharatrun.com" className={linkCls}>
                  info@atulyabharatrun.com
                </a>
              </div>
            </div>
          </div>

          <div>
            <div className={heading}>Newsletter</div>
            <p className="text-sm text-white/70">
              Get challenge launches and stories in your inbox.
            </p>
            <NewsletterForm source="footer" variant="dark" className="mt-4" />

          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="abr-container py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/60">
          <p>© {new Date().getFullYear()} Atulya Bharat Run. All rights reserved.</p>
          <p>Made with <span className="text-primary">❤</span> for India</p>
        </div>
      </div>
    </footer>
  );
};
