import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import type { SerializedVendorContact } from "@/lib/types";

export async function GET(_req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

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

  const serialized: SerializedVendorContact[] = contacts.map((c) => ({
    id: c.id,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    company: c.company,
    jobTitle: c.jobTitle,
  }));

  return NextResponse.json({ contacts: serialized });
}
