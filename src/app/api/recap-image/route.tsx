import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderEmailArtwork, type EmailArtworkSnapshot } from "@/lib/email-artwork";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const reminderId = request.nextUrl.searchParams.get("reminder");
  const kind = request.nextUrl.searchParams.get("kind");
  if (!reminderId || !kind) return new Response("Not found", { status: 404 });
  const { data, error } = await supabaseAdmin.from("push_reminders").select("recap_snapshot").eq("id", reminderId).maybeSingle();
  if (error) return new Response("Image temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!data?.recap_snapshot) return new Response("Not found", { status: 404 });
  try {
    const response = await renderEmailArtwork(data.recap_snapshot as EmailArtworkSnapshot, kind, { density: request.nextUrl.searchParams.get("density") });
    response.headers.set("Cache-Control", "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800");
    return response;
  } catch (error) {
    console.error("recap image render failed", error);
    return new Response("Image unavailable. Open Pick'em to view results.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
