import { z } from "zod"

const stellarPublicKeyRegex = /^G[A-HJ-NP-Z0-9]{55}$/

export const walletSchema = z.object({
  publicKey: z.string().regex(stellarPublicKeyRegex, "Invalid Stellar public key"),
})

export const assetFormSchema = z.object({
  name: z.string().min(1, "Asset name is required").max(100, "Asset name too long"),
  code: z.string().min(1, "Asset code is required").max(12, "Asset code max 12 characters"),
  description: z.string().max(1000, "Description too long").optional(),
  totalSupply: z.string().min(1, "Total supply is required").regex(/^\d+(\.\d+)?$/, "Must be a valid number"),
  issuer: z.string().regex(stellarPublicKeyRegex, "Invalid Stellar public key").optional(),
})

export const kycSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required").regex(/^\+?[\d\s\-()]{7,20}$/, "Invalid phone number"),
  country: z.string().min(1, "Country is required"),
  address: z.string().min(1, "Address is required").max(500),
  dateOfBirth: z.string().min(1, "Date of birth is required").regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  idType: z.enum(["passport", "drivers_license", "national_id", "other"]),
  idNumber: z.string().min(1, "ID number is required").max(100),
})

export const listingFormSchema = z.object({
  assetId: z.string().min(1, "Asset is required"),
  price: z.string().min(1, "Price is required").regex(/^\d+(\.\d{1,7})?$/, "Invalid price"),
  amount: z.string().min(1, "Amount is required").regex(/^\d+(\.\d+)?$/, "Invalid amount"),
})

export const searchSchema = z.object({
  query: z.string().max(200).optional(),
  category: z.string().optional(),
  minPrice: z.string().regex(/^\d+(\.\d+)?$/, "Invalid minimum price").optional().or(z.literal("")),
  maxPrice: z.string().regex(/^\d+(\.\d+)?$/, "Invalid maximum price").optional().or(z.literal("")),
  location: z.string().optional(),
  sortBy: z.enum(["price_asc", "price_desc", "name_asc", "name_desc", "newest", "oldest"]).optional(),
})

export const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(1, "Message is required").max(5000),
})

export const settingsFormSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(100),
  email: z.string().email("Invalid email address"),
  notifications: z.boolean().optional(),
  twoFactor: z.boolean().optional(),
  theme: z.enum(["light", "dark", "system"]),
})

export type AssetFormData = z.infer<typeof assetFormSchema>
export type KYCFormData = z.infer<typeof kycSchema>
export type ListingFormData = z.infer<typeof listingFormSchema>
export type SearchFormData = z.infer<typeof searchSchema>
export type ContactFormData = z.infer<typeof contactFormSchema>
export type SettingsFormData = z.infer<typeof settingsFormSchema>

export async function validateUniqueField(
  field: string,
  value: string,
): Promise<boolean> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
    const res = await fetch(`${backendUrl}/api/v1/validate/${field}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    })
    if (!res.ok) return true
    const data = await res.json()
    return data.unique !== false
  } catch {
    return true
  }
}

export async function validateEmailUnique(
  email: string,
): Promise<boolean> {
  return validateUniqueField("email", email)
}

export async function validateAssetCodeUnique(
  code: string,
): Promise<boolean> {
  return validateUniqueField("asset_code", code)
}
