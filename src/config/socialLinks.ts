export const socialLinks = [
  { name: "Facebook", href: "https://www.facebook.com/atulyabharatrun" },
  { name: "Instagram", href: "https://www.instagram.com/atulyabharatrun" },
  { name: "YouTube", href: "https://www.youtube.com/@AtulyaBharatRun" },
] as const;

export type SocialLink = (typeof socialLinks)[number];
