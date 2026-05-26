import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(64),
  lastName: z.string().min(1, "Last name is required").max(64),
  company: z.string().max(128).optional().nullable(),
  phone: z
    .string()
    .regex(/^\+1\d{10}$/, "Phone must be a valid US number")
    .optional()
    .nullable(),
});

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { firstName, lastName, company, phone } = parsed.data;

  const updated = await prisma.user.update({
    where: { supabaseId: user.id },
    data: {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      company: company ?? null,
      phone: phone ?? null,
      onboarded: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      company: true,
      phone: true,
      onboarded: true,
    },
  });

  return NextResponse.json(updated);
}
