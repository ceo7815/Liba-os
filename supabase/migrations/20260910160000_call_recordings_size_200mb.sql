-- Raise call-recordings upload limit to 200MB (long call recordings).
UPDATE storage.buckets
SET file_size_limit = 209715200
WHERE id = 'call-recordings';
