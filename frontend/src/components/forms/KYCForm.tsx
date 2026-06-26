"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { kycSchema, type KYCFormData } from "@/lib/validation-schemas"
import { AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface FieldError {
  field: string
  message: string
}

interface KYCFormProps {
  onSubmit: (data: KYCFormData) => Promise<void>
  className?: string
}

export function KYCForm({ onSubmit, className }: KYCFormProps) {
  const [formData, setFormData] = useState<KYCFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    address: "",
    dateOfBirth: "",
    idType: "passport",
    idNumber: "",
  })
  const [errors, setErrors] = useState<FieldError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const getFieldError = (field: string): string | undefined =>
    errors.find((e) => e.field === field)?.message

  const clearFieldError = (field: string) =>
    setErrors((prev) => prev.filter((e) => e.field !== field))

  const handleChange = (field: keyof KYCFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    clearFieldError(field)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])

    const result = kycSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }))
      setErrors(fieldErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(result.data)
    } catch {
      setErrors([{ field: "_form", message: "Failed to submit KYC. Please try again." }])
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle>KYC Verification</CardTitle>
        <CardDescription>Please provide your identity information for verification.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.find((e) => e.field === "_form") && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errors.find((e) => e.field === "_form")?.message}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName" className={cn(getFieldError("firstName") && "text-destructive")}>
                First Name
              </Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                aria-invalid={!!getFieldError("firstName")}
              />
              {getFieldError("firstName") && (
                <p className="text-xs text-destructive">{getFieldError("firstName")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className={cn(getFieldError("lastName") && "text-destructive")}>
                Last Name
              </Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                aria-invalid={!!getFieldError("lastName")}
              />
              {getFieldError("lastName") && (
                <p className="text-xs text-destructive">{getFieldError("lastName")}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email" className={cn(getFieldError("email") && "text-destructive")}>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                aria-invalid={!!getFieldError("email")}
              />
              {getFieldError("email") && (
                <p className="text-xs text-destructive">{getFieldError("email")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className={cn(getFieldError("phone") && "text-destructive")}>
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+1234567890"
                aria-invalid={!!getFieldError("phone")}
              />
              {getFieldError("phone") && (
                <p className="text-xs text-destructive">{getFieldError("phone")}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => handleChange("country", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className={cn(getFieldError("dateOfBirth") && "text-destructive")}>
                Date of Birth
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                aria-invalid={!!getFieldError("dateOfBirth")}
              />
              {getFieldError("dateOfBirth") && (
                <p className="text-xs text-destructive">{getFieldError("dateOfBirth")}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>ID Type</Label>
              <Select
                value={formData.idType}
                onValueChange={(value) => handleChange("idType", value as KYCFormData["idType"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ID type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="drivers_license">Driver&apos;s License</SelectItem>
                  <SelectItem value="national_id">National ID</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="idNumber" className={cn(getFieldError("idNumber") && "text-destructive")}>
                ID Number
              </Label>
              <Input
                id="idNumber"
                value={formData.idNumber}
                onChange={(e) => handleChange("idNumber", e.target.value)}
                aria-invalid={!!getFieldError("idNumber")}
              />
              {getFieldError("idNumber") && (
                <p className="text-xs text-destructive">{getFieldError("idNumber")}</p>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Submitting..." : "Submit KYC"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
