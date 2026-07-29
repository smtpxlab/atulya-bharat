
ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'cancelled';
