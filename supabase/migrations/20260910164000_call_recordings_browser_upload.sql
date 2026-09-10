-- Allow logged-in users to upload call recordings directly from the browser.
-- Path convention: uploads/<callId>/...

DROP POLICY IF EXISTS "authenticated_insert_call_recordings" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_call_recordings" ON storage.objects;

CREATE POLICY "authenticated_insert_call_recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'call-recordings'
  AND (storage.foldername(name))[1] = 'uploads'
);

CREATE POLICY "authenticated_update_call_recordings"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'call-recordings'
  AND (storage.foldername(name))[1] = 'uploads'
)
WITH CHECK (
  bucket_id = 'call-recordings'
  AND (storage.foldername(name))[1] = 'uploads'
);

-- Relax mime filter; app validates audio extensions server-side.
UPDATE storage.buckets
SET
  file_size_limit = 524288000,
  allowed_mime_types = NULL
WHERE id = 'call-recordings';
