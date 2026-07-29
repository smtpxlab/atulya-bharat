import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthBootstrap } from "@/features/auth/AuthBootstrap";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { UserRoute } from "@/components/auth/UserRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import RouteProgress from "@/components/RouteProgress";
import { SiteLayout } from "@/components/layout/SiteLayout";
import AdminLayout from "@/features/admin/layout/AdminLayout";
import CheckoutSkeleton from "@/components/skeletons/CheckoutSkeleton";
import ChallengeDetailSkeleton from "@/components/skeletons/ChallengeDetailSkeleton";
import BlogPostSkeleton from "@/components/skeletons/BlogPostSkeleton";
import ClubDetailSkeleton from "@/components/skeletons/ClubDetailSkeleton";
import FormPageSkeleton from "@/components/skeletons/FormPageSkeleton";

// Hot public pages — eager so internal nav never shows a Suspense fallback.
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import Challenges from "./pages/Challenges";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Security from "./pages/Security";
import Clubs from "./pages/Clubs";
import Leaderboard from "./pages/Leaderboard";
import Blog from "./pages/Blog";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import LegalPage from "./pages/LegalPage";

// Heavier / rarer pages stay lazy.
const ChallengeDetail = lazy(() => import("./pages/ChallengeDetail"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const ClubDetail = lazy(() => import("./pages/ClubDetail"));
const CreateClub = lazy(() => import("./pages/CreateClub"));
const StravaCallback = lazy(() => import("./pages/StravaCallback"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const RegistrationDetail = lazy(() => import("./pages/RegistrationDetail"));
const NotificationsPage = lazy(() => import("./pages/Notifications"));

// Admin pages — eager. The whole module is gated behind admin auth so
// code-splitting it doesn't help first paint, but lazy chunks would cause
// a fallback flash on every admin nav.
import AdminDashboardPage from "./features/admin/pages/AdminDashboardPage";
import ComingSoonPage from "./features/admin/pages/ComingSoonPage";
import ChallengeListPage from "./features/admin/pages/challenges/ChallengeListPage";
import ChallengeCreatePage from "./features/admin/pages/challenges/ChallengeCreatePage";
import ChallengeEditPage from "./features/admin/pages/challenges/ChallengeEditPage";
import ChallengeRouteEditPage from "./features/admin/pages/challenges/ChallengeRouteEditPage";
import ChallengeParticipantsPage from "./features/admin/pages/challenges/ChallengeParticipantsPage";
import ClubListPage from "./features/admin/pages/clubs/ClubListPage";
import ClubCreatePage from "./features/admin/pages/clubs/ClubCreatePage";
import ClubDetailPage from "./features/admin/pages/clubs/ClubDetailPage";
import ClubEditPage from "./features/admin/pages/clubs/ClubEditPage";
import ClubReportsPage from "./features/admin/pages/clubs/ClubReportsPage";
import MilestoneListPage from "./features/admin/pages/milestones/MilestoneListPage";
import MilestoneCreatePage from "./features/admin/pages/milestones/MilestoneCreatePage";
import MilestoneEditPage from "./features/admin/pages/milestones/MilestoneEditPage";
import BlogListPage from "./features/admin/pages/blog/BlogListPage";
import BlogCreatePage from "./features/admin/pages/blog/BlogCreatePage";
import BlogEditPage from "./features/admin/pages/blog/BlogEditPage";
import PaymentGatewayListPage from "./features/admin/pages/payments/PaymentGatewayListPage";
import PaymentGatewayCreatePage from "./features/admin/pages/payments/PaymentGatewayCreatePage";
import PaymentGatewayEditPage from "./features/admin/pages/payments/PaymentGatewayEditPage";
import PageListPage from "./features/admin/pages/pages/PageListPage";
import PageCreatePage from "./features/admin/pages/pages/PageCreatePage";
import PageEditPage from "./features/admin/pages/pages/PageEditPage";
import GalleryListPage from "./features/admin/pages/gallery/GalleryListPage";
import AdminProfilePage from "./features/admin/pages/profile/AdminProfilePage";
import IamUserListPage from "./features/admin/pages/iam/IamUserListPage";
import AuditLogPage from "./features/admin/pages/iam/AuditLogPage";
import CouponListPage from "./features/admin/pages/coupons/CouponListPage";
import CouponCreatePage from "./features/admin/pages/coupons/CouponCreatePage";
import CouponEditPage from "./features/admin/pages/coupons/CouponEditPage";
import TestimonialListPage from "./features/admin/pages/testimonials/TestimonialListPage";
import TestimonialCreatePage from "./features/admin/pages/testimonials/TestimonialCreatePage";
import TestimonialEditPage from "./features/admin/pages/testimonials/TestimonialEditPage";
import FaqListPage from "./features/admin/pages/faqs/FaqListPage";
import FaqCreatePage from "./features/admin/pages/faqs/FaqCreatePage";
import FaqEditPage from "./features/admin/pages/faqs/FaqEditPage";
import NotificationListPage from "./features/admin/pages/notifications/NotificationListPage";
import NotificationCreatePage from "./features/admin/pages/notifications/NotificationCreatePage";
import NotificationEditPage from "./features/admin/pages/notifications/NotificationEditPage";
import NewsletterListPage from "./features/admin/pages/newsletter/NewsletterListPage";
import BookingListPage from "./features/admin/pages/bookings/BookingListPage";
import BookingDetailPage from "./features/admin/pages/bookings/BookingDetailPage";

// Wrap a lazy route in a Suspense boundary with a route-specific skeleton.
const L = (node: React.ReactNode, fallback: React.ReactNode = null) => (
  <Suspense fallback={fallback}>{node}</Suspense>
);

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthBootstrap />
      <ScrollToTop />
      <RouteProgress />
      <ErrorBoundary>
        <Routes>
          {/* Public + authenticated pages share the persistent SiteLayout */}
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route
              path="/challenges/:slug"
              element={L(<ChallengeDetail />, <ChallengeDetailSkeleton />)}
            />
            <Route
              path="/challenges/:slug/checkout"
              element={<ErrorBoundary>{L(<CheckoutPage />, <CheckoutSkeleton />)}</ErrorBoundary>}
            />
            <Route path="/dashboard/challenges" element={<UserRoute><ErrorBoundary><Dashboard /></ErrorBoundary></UserRoute>} />
            <Route
              path="/my-challenges/:registrationId"
              element={<UserRoute><ErrorBoundary>{L(<RegistrationDetail />)}</ErrorBoundary></UserRoute>}
            />

            <Route path="/clubs" element={<Clubs />} />
            <Route path="/clubs/:slug" element={L(<ClubDetail />, <ClubDetailSkeleton />)} />
            <Route path="/clubs/create" element={<ProtectedRoute><ErrorBoundary>{L(<CreateClub />, <FormPageSkeleton />)}</ErrorBoundary></ProtectedRoute>} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={L(<BlogPost />, <BlogPostSkeleton />)} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about" element={<About />} />
            <Route path="/terms-and-conditions" element={<LegalPage slug="terms-and-conditions" />} />
            <Route path="/privacy-policy" element={<LegalPage slug="privacy-policy" />} />
            <Route path="/refund-return-policy" element={<LegalPage slug="refund-return-policy" />} />
            <Route path="/dashboard" element={<UserRoute><ErrorBoundary><Dashboard /></ErrorBoundary></UserRoute>} />
            <Route path="/profile" element={<UserRoute><ErrorBoundary><Profile /></ErrorBoundary></UserRoute>} />
            <Route path="/security" element={<UserRoute><ErrorBoundary><Security /></ErrorBoundary></UserRoute>} />
            <Route path="/notifications" element={<UserRoute><ErrorBoundary>{L(<NotificationsPage />)}</ErrorBoundary></UserRoute>} />


            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Routes without site chrome */}
          <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
          <Route path="/signup" element={<ErrorBoundary><Signup /></ErrorBoundary>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/auth/strava/callback"
            element={<ProtectedRoute><ErrorBoundary>{L(<StravaCallback />)}</ErrorBoundary></ProtectedRoute>}
          />


          {/* Admin shell */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="challenges" element={<ChallengeListPage />} />
            <Route path="challenges/new" element={<ChallengeCreatePage />} />
            
            <Route path="challenges/:id/edit" element={<ChallengeEditPage />} />
            <Route path="challenges/:id/edit-route" element={<ChallengeRouteEditPage />} />
            <Route path="challenges/:id/participants" element={<ChallengeParticipantsPage />} />
            <Route path="clubs" element={<ClubListPage />} />
            <Route path="clubs/new" element={<ClubCreatePage />} />
            <Route path="clubs/reports" element={<ClubReportsPage />} />
            <Route path="clubs/:id/edit" element={<ClubEditPage />} />
            <Route path="clubs/:id" element={<ClubDetailPage />} />
            <Route path="challenges/milestones" element={<MilestoneListPage />} />
            <Route path="challenges/milestones/create" element={<MilestoneCreatePage />} />
            <Route path="challenges/milestones/:id/edit" element={<MilestoneEditPage />} />
            <Route path="categories" element={<ComingSoonPage title="Categories" />} />
            <Route path="coupons" element={<CouponListPage />} />
            <Route path="coupons/new" element={<CouponCreatePage />} />
            <Route path="coupons/:id/edit" element={<CouponEditPage />} />
            <Route path="bookings" element={<BookingListPage />} />
            <Route path="bookings/:id" element={<BookingDetailPage />} />
            <Route path="banners" element={<ComingSoonPage title="Banners" />} />
            <Route path="notifications" element={<NotificationListPage />} />
            <Route path="notifications/new" element={<NotificationCreatePage />} />
            <Route path="notifications/:id/edit" element={<NotificationEditPage />} />
            <Route path="pages" element={<PageListPage />} />
            <Route path="pages/create" element={<PageCreatePage />} />
            <Route path="pages/:id/edit" element={<PageEditPage />} />
            <Route path="testimonials" element={<TestimonialListPage />} />
            <Route path="testimonials/new" element={<TestimonialCreatePage />} />
            <Route path="testimonials/:id/edit" element={<TestimonialEditPage />} />
            <Route path="gallery" element={<GalleryListPage />} />
            <Route path="blog" element={<BlogListPage />} />
            <Route path="blog/new" element={<BlogCreatePage />} />
            <Route path="blog/:id/edit" element={<BlogEditPage />} />
            <Route path="newsletter" element={<NewsletterListPage />} />
            <Route path="faqs" element={<FaqListPage />} />
            <Route path="faqs/new" element={<FaqCreatePage />} />
            <Route path="faqs/:id/edit" element={<FaqEditPage />} />
            <Route path="faq" element={<FaqListPage />} />
            <Route path="payment-settings" element={<PaymentGatewayListPage />} />
            <Route path="payment-settings/new" element={<PaymentGatewayCreatePage />} />
            <Route path="payment-settings/:id/edit" element={<PaymentGatewayEditPage />} />
            <Route path="users" element={<IamUserListPage />} />
            <Route path="security-log" element={<AuditLogPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
