/**
 * Utility to construct safe local media streaming URLs.
 * Uses query parameters to prevent Windows drive letters (e.g. E:) from being
 * mangled by Chromium's URL authority parser.
 */

export function getMediaUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  return `media://local/?path=${encodeURIComponent(filePath)}`;
}
