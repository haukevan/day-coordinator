import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(64).optional(),
  lastName: z.string().min(1, "Last name is required").max(64).optional(),
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

  const { firstName, lastName, phone } = parsed.data;

  // Build update data from provided fields only (partial PATCH)
  const updateData: Record<string, unknown> = {};

  if (firstName !== undefined) {
    updateData.firstName = firstName;
    updateData.name = `${firstName} ${lastName ?? ""}`.trim();
  }
  if (lastName !== undefined) {
    updateData.lastName = lastName;
    if (firstName === undefined && updateData.name === undefined) {
      // Only lastName provided — reconstruct name from existing
      const existing = await prisma.user.findUnique({
        where: { supabaseId: user.id },
        select: { firstName: true },
      });
      updateData.name = `${existing?.firstName ?? ""} ${lastName}`.trim();
    }
  }
  if (phone !== undefined) updateData.phone = phone ?? null;

  // Require at least one field
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 422 });
  }

  const updated = await prisma.user.update({
    where: { supabaseId: user.id },
    data: updateData,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      phone: true,
      onboarded: true,
    },
  });

  return NextResponse.json(updated);
}
