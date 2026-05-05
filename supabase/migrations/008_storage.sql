-- Create doctrine-docs storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('doctrine-docs', 'doctrine-docs', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to manage doctrine docs
DROP POLICY IF EXISTS "NCO upload doctrine" ON storage.objects;
CREATE POLICY "NCO upload doctrine" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'doctrine-docs');

DROP POLICY IF EXISTS "NCO read doctrine" ON storage.objects;
CREATE POLICY "NCO read doctrine" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'doctrine-docs');

DROP POLICY IF EXISTS "NCO delete doctrine" ON storage.objects;
CREATE POLICY "NCO delete doctrine" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'doctrine-docs');

-- Aggregate function for listing library docs
CREATE OR REPLACE FUNCTION list_library_docs()
RETURNS TABLE (doc_name text, chunk_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT doc_name, COUNT(*) AS chunk_count
  FROM public.document_chunks
  GROUP BY doc_name
  ORDER BY doc_name;
$$;
