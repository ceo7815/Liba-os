-- Private storage for call-control recordings uploaded from Liba OS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-recordings',
  'call-recordings',
  false,
  104857600,
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/webm',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'video/mp4',
    'video/webm',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Access only via service role in server actions / MCP (no authenticated policies)
