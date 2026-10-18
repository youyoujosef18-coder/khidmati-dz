import { NextResponse } from "next/server";
import { getCommunes } from "@/lib/services/discovery";

export async function GET(req: Request) {
  const wilaya = new URL(req.url).searchParams.get("wilaya") ?? "";
  if (!/^\d{2}$/.test(wilaya)) return NextResponse.json({ communes: [] }, { status: 400 });
  const communes = await getCommunes(wilaya);
  return NextResponse.json({ communes }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}
