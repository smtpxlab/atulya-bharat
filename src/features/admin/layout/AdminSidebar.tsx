import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Trophy,
  Users,
  ShieldCheck,
  Flag,
  Tags,
  Ticket,
  Image as ImageIcon,
  
  FileText,
  MessageSquare,
  Newspaper,
  Mail,
  HelpCircle,
  Megaphone,
  CreditCard,
  Receipt,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  comingSoon?: boolean;
};

const primary: NavItem[] = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Challenges", url: "/admin/challenges", icon: Trophy },
  { title: "Milestones", url: "/admin/challenges/milestones", icon: Flag },
  { title: "Clubs", url: "/admin/clubs", icon: Users },
  { title: "Club Reports", url: "/admin/clubs/reports", icon: FileText },
  { title: "Coupons", url: "/admin/coupons", icon: Ticket },
  { title: "Bookings", url: "/admin/bookings", icon: Receipt },
];

const secondary: NavItem[] = [
  { title: "Categories", url: "/admin/categories", icon: Tags, comingSoon: true },
  { title: "Banners", url: "/admin/banners", icon: ImageIcon, comingSoon: true },
  { title: "Pages", url: "/admin/pages", icon: FileText },
  { title: "Testimonials", url: "/admin/testimonials", icon: MessageSquare },
  { title: "Gallery", url: "/admin/gallery", icon: ImageIcon },
  { title: "Blog", url: "/admin/blog", icon: Newspaper },
  { title: "Newsletter", url: "/admin/newsletter", icon: Mail },
  { title: "FAQs", url: "/admin/faqs", icon: HelpCircle },
  { title: "Notifications", url: "/admin/notifications", icon: Megaphone },
  { title: "Payment Settings", url: "/admin/payment-settings", icon: CreditCard },
  { title: "Users & Access", url: "/admin/users", icon: Users },
  { title: "Security Log", url: "/admin/security-log", icon: ShieldCheck },
  { title: "Profile", url: "/admin/profile", icon: User },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const isActive = (url: string) =>
    url === "/admin" ? pathname === "/admin" : pathname.startsWith(url);

  const renderItem = (item: NavItem) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
        <NavLink to={item.url} className="flex items-center gap-2">
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="flex-1 truncate">
              {item.title}
              {item.comingSoon && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  soon
                </span>
              )}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{primary.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Content</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{secondary.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
