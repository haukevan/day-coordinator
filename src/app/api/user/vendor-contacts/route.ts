import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import type { SerializedVendorContact } from "@/lib/types";
import { checkVendorContactLimit } from "@/lib/db/limits";

const createVendorContactSchema = z.object({
  email: z.string().email("Valid email is required.").max(254),
  firstName: z.string().max(128).optional(),
  lastName: z.string().max(128).optional(),
  phone: z.string().max(20).optional(),
  company: z.string().max(128).optional(),
  jobTitle: z.string().max(128).optional(),
});

function serialize(contact: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
}): SerializedVendorContact {
  return {
    id: contact.id,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phone,
    company: contact.company,
    jobTitle: contact.jobTitle,
  };
}

export async function GET(_req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const contacts = await prisma.vendorContact.findMany({
    where: { ownerId: dbUser.id },
    orderBy: [{ firstName: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      company: true,
      jobTitle: true,
    },
  });

  const serialized: SerializedVendorContact[] = contacts.map(serialize);

  return NextResponse.json({ contacts: serialized });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Enforce per-user vendor contact limit
  const contactLimit = await checkVendorContactLimit(dbUser.id);
  if (!contactLimit.allowed) {
    return NextResponse.json(
      {
        error: `You've reached the maximum of ${contactLimit.max} saved contacts.`,
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createVendorContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { email, firstName, lastName, phone, company, jobTitle } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Check for duplicate email
  const existing = await prisma.vendorContact.findUnique({
    where: {
      ownerId_email: { ownerId: dbUser.id, email: normalizedEmail },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A vendor with this email already exists in your contacts." },
      { status: 409 },
    );
  }

  const contact = await prisma.vendorContact.create({
    data: {
      ownerId: dbUser.id,
      email: normalizedEmail,
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      jobTitle: jobTitle?.trim() || null,
    },
  });

  return NextResponse.json({ contact: serialize(contact) }, { status: 201 });
}
