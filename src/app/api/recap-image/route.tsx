import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderEmailArtwork, type EmailArtworkSnapshot } from "@/lib/email-artwork";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED_ARTWORKS = 32;
const artworkCache = new Map<string, { body: Buffer; createdAt: number }>();

function artworkCacheKey(snapshot: EmailArtworkSnapshot, kind: string, density: string) {
  return createHash("sha256").update(JSON.stringify(snapshot)).update("|").update(kind).update("|").update(density).digest("hex");
}

function cachedArtwork(key: string) {
  const hit = artworkCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.createdAt > CACHE_TTL_MS) {
    artworkCache.delete(key);
    return null;
  }
  artworkCache.delete(key);
  artworkCache.set(key, hit);
  return hit.body;
}

function storeArtwork(key: string, body: Buffer) {
  artworkCache.delete(key);
  artworkCache.set(key, { body, createdAt: Date.now() });
  while (artworkCache.size > MAX_CACHED_ARTWORKS) artworkCache.delete(artworkCache.keys().next().value!);
}

function responseBody(body: Buffer) {
  const output = new ArrayBuffer(body.byteLength);
  new Uint8Array(output).set(body);
  return output;
}

export async function GET(request: NextRequest) {
  const reminderId = request.nextUrl.searchParams.get("reminder");
  const kind = request.nextUrl.searchParams.get("kind");
  if (!reminderId || !kind) return new Response("Not found", { status: 404 });
  const { data, error } = await supabaseAdmin.from("push_reminders").select("recap_snapshot").eq("id", reminderId).maybeSingle();
  if (error) return new Response("Image temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!data?.recap_snapshot) return new Response("Not found", { status: 404 });
  try {
    const snapshot = data.recap_snapshot as EmailArtworkSnapshot;
    const density = request.nextUrl.searchParams.get("density") ?? "compact";
    const key = artworkCacheKey(snapshot, kind, density);
    const cached = cachedArtwork(key);
    if (cached) return new Response(responseBody(cached), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800" } });
    const response = await renderEmailArtwork(snapshot, kind, { density });
    const body = Buffer.from(await response.arrayBuffer());
    storeArtwork(key, body);
    response.headers.set("Cache-Control", "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800");
    return new Response(responseBody(body), { headers: response.headers });
  } catch (error) {
    console.error("recap image render failed", error);
    return new Response("Image unavailable. Open Pick'em to view results.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
