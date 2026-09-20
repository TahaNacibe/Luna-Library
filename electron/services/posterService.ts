import https from "https";
import http from "http";
import { cleanMovieTitle } from "./libraryService";

/**
 * Service to automatically fetch movie & video posters online when no local cover exists.
 * Uses:
 * 1. Wikipedia PageImages API (with pilicense=any & pithumbsize=600 for official theatrical posters)
 * 2. TVMaze Singlesearch API (for series and shows)
 * 3. Fallback DuckDuckGo / Open Search
 * All endpoints require no private API key and provide high-resolution artwork.
 */

const posterCache = new Map<string, string | null>();

/**
 * Helper to perform HTTPS/HTTP GET and return JSON response.
 */
function httpGetJson<T>(url: string): Promise<T | null> {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": "LunaLibrary/1.0 (https://github.com/Luna-Library; movie-posters@luna.app)",
          Accept: "application/json",
        },
        timeout: 7000,
      },
      (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          resolve(null);
          return;
        }

        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Fetches theatrical movie poster from Wikipedia PageImages API.
 * Uses generator=search with 'film' keyword and pilicense=any to find promotional posters.
 */
async function fetchFromWikipedia(cleanedTitle: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      cleanedTitle + " film"
    )}&gsrlimit=1&prop=pageimages&pilicense=any&pithumbsize=600&format=json`;

    const data = await httpGetJson<any>(url);
    if (data?.query?.pages) {
      const firstPage = Object.values(data.query.pages)[0] as any;
      if (firstPage?.thumbnail?.source) {
        return firstPage.thumbnail.source;
      }
    }
  } catch {
    // Fallback to next provider
  }
  return null;
}

/**
 * Fetches poster image from TVMaze API (ideal for TV shows & series).
 */
async function fetchFromTVMaze(cleanedTitle: string): Promise<string | null> {
  try {
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(
      cleanedTitle
    )}`;
    const data = await httpGetJson<any>(url);

    if (data?.image?.original) {
      return data.image.original;
    }
    if (data?.image?.medium) {
      return data.image.medium;
    }
  } catch {
    // Ignore error
  }
  return null;
}

/**
 * Secondary search on Wikipedia without the 'film' suffix for general entries or documentaries.
 */
async function fetchFromWikipediaGeneral(cleanedTitle: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      cleanedTitle
    )}&gsrlimit=1&prop=pageimages&pilicense=any&pithumbsize=600&format=json`;

    const data = await httpGetJson<any>(url);
    if (data?.query?.pages) {
      const firstPage = Object.values(data.query.pages)[0] as any;
      if (firstPage?.thumbnail?.source) {
        return firstPage.thumbnail.source;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Main poster resolver.
 * Cleans the folder/entry name, checks memory cache, and queries providers.
 */
export async function fetchMoviePoster(title: string): Promise<string | null> {
  const cleaned = cleanMovieTitle(title);
  if (!cleaned) return null;

  if (posterCache.has(cleaned)) {
    return posterCache.get(cleaned) || null;
  }

  // 1. Try Wikipedia Film Search (Theatrical posters with pilicense=any)
  let poster = await fetchFromWikipedia(cleaned);

  // 2. If not found, try TVMaze (Series / Shows)
  if (!poster) {
    poster = await fetchFromTVMaze(cleaned);
  }

  // 3. If still not found, try general Wikipedia entry
  if (!poster) {
    poster = await fetchFromWikipediaGeneral(cleaned);
  }

  // Cache result to avoid hammering external APIs
  posterCache.set(cleaned, poster);
  return poster;
}
