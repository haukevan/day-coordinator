type VendorNameSource = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
};

/**
 * Human-readable vendor label.
 * Prefers a person's name, then company, then email as a last resort.
 */
export function vendorDisplayName(vendor: VendorNameSource): string {
  const person = [vendor.firstName, vendor.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim();

  if (person) return person;
  if (vendor.company?.trim()) return vendor.company.trim();
  if (vendor.email?.trim()) return vendor.email.trim();
  return "Unknown vendor";
}
