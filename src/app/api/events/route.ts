import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";
import { nanoid } from "nanoid";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function uniqueSlug(base: string): Promise<string> {
  const candidate = slugify(base);
  const existing = await prisma.event.findUnique({ where: { slug: candidate } });
  if (!existing) return candidate;
  return `${candidate}-${nanoid(6)}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, eventDate, timezone, slug } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const resolvedSlug = slug?.trim()
    ? await uniqueSlug(slug.trim())
    : undefined;

  const event = await prisma.event.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      eventDate: eventDate ? new Date(eventDate) : null,
      timezone: timezone || "UTC",
      slug: resolvedSlug ?? null,
      ownerId: dbUser.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      eventId: event.id,
      userId: dbUser.id,
      action: "event.created",
      metadata: { title: event.title },
    },
  });

  await emitEventUpdate(event.id, "event.created", { eventId: event.id, title: event.title });

  return NextResponse.json({ event }, { status: 201 });
}
