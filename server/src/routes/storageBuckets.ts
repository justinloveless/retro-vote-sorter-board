/** Bucket prefixes under the retroscope_uploads volume. */
export const STORAGE_BUCKET_PREFIXES = [
  'avatars',
  'poker-session-chat-images',
  'retro-audio',
  'tts-audio-cache',
] as const;

export type StorageBucketPrefix = (typeof STORAGE_BUCKET_PREFIXES)[number];

/** Buckets that may be fetched without auth (public URLs / FE getPublicUrl). */
export const PUBLIC_STORAGE_BUCKETS = new Set<StorageBucketPrefix>([
  'avatars',
  'poker-session-chat-images',
  'retro-audio',
  'tts-audio-cache',
]);
