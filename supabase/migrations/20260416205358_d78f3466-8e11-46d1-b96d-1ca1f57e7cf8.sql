-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.media_type AS ENUM ('image', 'audio', 'video');
CREATE TYPE public.activity_source AS ENUM ('strava', 'manual', 'abr_app');
CREATE TYPE public.activity_mode AS ENUM ('run', 'walk', 'ride', 'any');
CREATE TYPE public.registration_status AS ENUM ('pending_payment', 'active', 'completed', 'abandoned');
CREATE TYPE public.order_status AS ENUM ('created', 'paid', 'failed', 'refunded');
CREATE TYPE public.club_role AS ENUM ('member', 'admin', 'owner');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  bio TEXT,
  total_km_logged NUMERIC NOT NULL DEFAULT 0,
  challenges_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ CHALLENGES ============
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  total_distance_km NUMERIC NOT NULL,
  description_short TEXT,
  description_long TEXT,
  cover_image_url TEXT,
  route_map_image_url TEXT,
  activity_modes TEXT[] NOT NULL DEFAULT ARRAY['run','walk','ride'],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_new BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- ============ CHALLENGE_TICKETS ============
CREATE TABLE public.challenge_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_inr INTEGER NOT NULL,
  includes TEXT[],
  includes_medal BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.challenge_tickets ENABLE ROW LEVEL SECURITY;

-- ============ MILESTONES ============
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  landmark_name TEXT NOT NULL,
  unlock_at_km NUMERIC NOT NULL,
  description TEXT,
  fun_fact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, sequence_no)
);
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- ============ MILESTONE_MEDIA ============
CREATE TABLE public.milestone_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  media_type public.media_type NOT NULL,
  storage_url TEXT NOT NULL,
  caption TEXT,
  language TEXT NOT NULL DEFAULT 'hi',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  file_size_bytes INTEGER,
  duration_seconds INTEGER
);
ALTER TABLE public.milestone_media ENABLE ROW LEVEL SECURITY;

-- ============ REGISTRATIONS ============
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.challenge_tickets(id),
  activity_mode public.activity_mode,
  target_days INTEGER,
  total_km_logged NUMERIC NOT NULL DEFAULT 0,
  status public.registration_status NOT NULL DEFAULT 'active',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, challenge_id)
);
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- ============ ACTIVITY_LOGS ============
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
  source public.activity_source NOT NULL DEFAULT 'manual',
  distance_km NUMERIC NOT NULL,
  activity_date DATE NOT NULL,
  activity_type TEXT,
  strava_activity_id BIGINT,
  raw_data JSONB,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============ USER_MILESTONES ============
CREATE TABLE public.user_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  km_at_unlock NUMERIC,
  share_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, milestone_id)
);
ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status public.order_status NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ============ STRAVA_TOKENS ============
CREATE TABLE public.strava_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  strava_athlete_id BIGINT UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);
ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;

-- ============ CLUBS ============
CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  promoter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- ============ CLUB_MEMBERS ============
CREATE TABLE public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.club_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, user_id)
);
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- ============ BLOG_POSTS ============
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  cover_image_url TEXT,
  excerpt TEXT,
  content_md TEXT,
  author TEXT,
  tags TEXT[],
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- ============ GALLERY_IMAGES ============
CREATE TABLE public.gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_url TEXT NOT NULL,
  caption TEXT,
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  event_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- ============ TESTIMONIALS ============
CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  city TEXT,
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- ============ INDEXES ============
CREATE INDEX idx_challenges_active ON public.challenges(is_active, sort_order);
CREATE INDEX idx_tickets_challenge ON public.challenge_tickets(challenge_id, sort_order);
CREATE INDEX idx_milestones_challenge ON public.milestones(challenge_id, sequence_no);
CREATE INDEX idx_media_milestone ON public.milestone_media(milestone_id, sort_order);
CREATE INDEX idx_registrations_user ON public.registrations(user_id);
CREATE INDEX idx_registrations_challenge ON public.registrations(challenge_id);
CREATE INDEX idx_activity_user ON public.activity_logs(user_id, activity_date DESC);
CREATE INDEX idx_activity_registration ON public.activity_logs(registration_id);
CREATE INDEX idx_user_milestones_user ON public.user_milestones(user_id);
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_club_members_club ON public.club_members(club_id);
CREATE INDEX idx_club_members_user ON public.club_members(user_id);
CREATE INDEX idx_blog_published ON public.blog_posts(is_published, published_at DESC);
CREATE INDEX idx_gallery_challenge ON public.gallery_images(challenge_id, sort_order);
CREATE INDEX idx_testimonials_approved ON public.testimonials(is_approved, created_at DESC);

-- ============ HANDLE_NEW_USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'city'
  );
  -- Default role: user
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles: public read, owner update, admin all
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage all profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- user_roles: users see own, admins manage all
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- challenges: public read active, admin all
CREATE POLICY "Active challenges viewable by everyone" ON public.challenges FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins view all challenges" ON public.challenges FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage challenges" ON public.challenges FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- challenge_tickets: public read, admin write
CREATE POLICY "Tickets viewable by everyone" ON public.challenge_tickets FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage tickets" ON public.challenge_tickets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- milestones: public read, admin write
CREATE POLICY "Milestones viewable by everyone" ON public.milestones FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage milestones" ON public.milestones FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- milestone_media: public read, admin write
CREATE POLICY "Media viewable by everyone" ON public.milestone_media FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage media" ON public.milestone_media FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- registrations: owner crud, admin all
CREATE POLICY "Users view own registrations" ON public.registrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own registrations" ON public.registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own registrations" ON public.registrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage registrations" ON public.registrations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- activity_logs: owner crud, admin all
CREATE POLICY "Users view own activity" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own activity" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own activity" ON public.activity_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own activity" ON public.activity_logs FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage activity" ON public.activity_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- user_milestones: owner read/insert, admin all
CREATE POLICY "Users view own milestones" ON public.user_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own milestones" ON public.user_milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own milestones" ON public.user_milestones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage user milestones" ON public.user_milestones FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- orders: owner read, owner insert, admin all (no user updates — payment status is server-set)
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage orders" ON public.orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- strava_tokens: NO client access. Only service role (edge functions) can read/write.
-- (RLS enabled with no policies = deny all by default for client requests.)

-- clubs: public read public clubs, promoter manage own, admin all
CREATE POLICY "Public clubs viewable by everyone" ON public.clubs FOR SELECT USING (is_public = TRUE);
CREATE POLICY "Promoters view own clubs" ON public.clubs FOR SELECT USING (auth.uid() = promoter_id);
CREATE POLICY "Promoters update own clubs" ON public.clubs FOR UPDATE USING (auth.uid() = promoter_id);
CREATE POLICY "Authenticated users create clubs" ON public.clubs FOR INSERT WITH CHECK (auth.uid() = promoter_id);
CREATE POLICY "Admins manage clubs" ON public.clubs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- club_members: public read for public clubs, owner self join/leave, admin all
CREATE POLICY "Members of public clubs viewable" ON public.club_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.is_public = TRUE)
);
CREATE POLICY "Users view own memberships" ON public.club_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users join clubs" ON public.club_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave clubs" ON public.club_members FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage memberships" ON public.club_members FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- blog_posts: public read published, admin write
CREATE POLICY "Published posts viewable by everyone" ON public.blog_posts FOR SELECT USING (is_published = TRUE);
CREATE POLICY "Admins view all posts" ON public.blog_posts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage posts" ON public.blog_posts FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- gallery_images: public read, admin write
CREATE POLICY "Gallery viewable by everyone" ON public.gallery_images FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage gallery" ON public.gallery_images FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- testimonials: public read approved, owner read/insert own, admin all
CREATE POLICY "Approved testimonials viewable" ON public.testimonials FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "Users view own testimonials" ON public.testimonials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own testimonials" ON public.testimonials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own testimonials" ON public.testimonials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage testimonials" ON public.testimonials FOR ALL USING (public.has_role(auth.uid(), 'admin'));