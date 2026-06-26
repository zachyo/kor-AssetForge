"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { listingFormSchema, type ListingFormData } from "@/lib/validation-schemas"
import { AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AssetOption {
  id: string
  name: string
  code: string
}

interface FieldError {
  field: string
  message: string
}

interface ListingFormProps {
  assets: AssetOption[]
  onSubmit: (data: ListingFormData) => Promise<void>
  className?: string
}

export function ListingForm({ assets, onSubmit, className }: ListingFormProps) {
  const [formData, setFormData] = useState<ListingFormData>({
    assetId: "",
    price: "",
    amount: "",
  })
  const [errors, setErrors] = useState<FieldError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const getFieldError = (field: string): string | undefined =>
    errors.find((e) => e.field === field)?.message

  const clearFieldError = (field: string) =>
    setErrors((prev) => prev.filter((e) => e.field !== field))

  const handleChange = (field: keyof ListingFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    clearFieldError(field)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])

    const result = listingFormSchema.safeParse(formData)
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
      setErrors([{ field: "_form", message: "Failed to create listing. Please try again." }])
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className={cn("w-full max-w-lg", className)}>
      <CardHeader>
        <CardTitle>Create Listing</CardTitle>
        <CardDescription>List your asset for sale on the marketplace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.find((e) => e.field === "_form") && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errors.find((e) => e.field === "_form")?.message}
            </div>
          )}

          <div className="space-y-2">
            <Label>Asset</Label>
            <Select
              value={formData.assetId}
              onValueChange={(value) => handleChange("assetId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an asset" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name} ({asset.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getFieldError("assetId") && (
              <p className="text-xs text-destructive">{getFieldError("assetId")}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price" className={cn(getFieldError("price") && "text-destructive")}>
                Price (USD)
              </Label>
              <Input
                id="price"
                type="number"
                step="0.0000001"
                min="0"
                value={formData.price}
                onChange={(e) => handleChange("price", e.target.value)}
                placeholder="0.00"
                aria-invalid={!!getFieldError("price")}
              />
              {getFieldError("price") && (
                <p className="text-xs text-destructive">{getFieldError("price")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount" className={cn(getFieldError("amount") && "text-destructive")}>
                Amount
              </Label>
              <Input
                id="amount"
                type="number"
                step="any"
                min="0"
                value={formData.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
                placeholder="1000"
                aria-invalid={!!getFieldError("amount")}
              />
              {getFieldError("amount") && (
                <p className="text-xs text-destructive">{getFieldError("amount")}</p>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Creating Listing..." : "Create Listing"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
