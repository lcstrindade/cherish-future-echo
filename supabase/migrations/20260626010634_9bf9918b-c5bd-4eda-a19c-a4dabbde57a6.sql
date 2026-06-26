
CREATE POLICY "Admins upload article media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'article-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update article media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'article-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete article media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'article-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read article media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'article-media' AND public.has_role(auth.uid(), 'admin'));
