
-- ---------- contact_enquiries: block client-set IP / user agent ----------
DROP POLICY IF EXISTS "Anyone can submit enquiries" ON public.contact_enquiries;
CREATE POLICY "Anyone can submit enquiries"
  ON public.contact_enquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    submitter_ip IS NULL
    AND user_agent IS NULL
    AND length(btrim(name))    BETWEEN 1 AND 200
    AND length(btrim(email))   BETWEEN 3 AND 320
    AND length(btrim(subject)) BETWEEN 1 AND 300
    AND length(btrim(message)) BETWEEN 1 AND 5000
  );

-- ---------- storage SELECT policies for content buckets ----------
CREATE POLICY "Public read challenge covers when enabled"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'challenge-covers'
    AND EXISTS (
      SELECT 1 FROM public.challenges ch
      WHERE ch.status = true
        AND (
          ch.cover_image_url LIKE '%' || storage.objects.name
          OR ch.about_map_image_url LIKE '%' || storage.objects.name
          OR ch.creative_image_url LIKE '%' || storage.objects.name
          OR ch.route_map_image_url LIKE '%' || storage.objects.name
          OR ch.certificate_image_url LIKE '%' || storage.objects.name
          OR ch.bib_image_url LIKE '%' || storage.objects.name
        )
    )
  );

CREATE POLICY "Public read milestone images for enabled milestones"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'milestone-images'
    AND EXISTS (
      SELECT 1 FROM public.challenge_milestones cm
      WHERE cm.status = true
        AND cm.spot_image_url LIKE '%' || storage.objects.name
    )
  );

CREATE POLICY "Public read milestone audio for enabled milestones"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'milestone-audio'
    AND EXISTS (
      SELECT 1 FROM public.challenge_milestones cm
      WHERE cm.status = true
        AND cm.audio_url LIKE '%' || storage.objects.name
    )
  );
