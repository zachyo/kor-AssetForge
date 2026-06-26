"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { assetFormSchema, validateAssetCodeUnique, type AssetFormData } from "@/lib/validation-schemas"
import { AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface FieldError {
  field: string
  message: string
}

interface AssetFormProps {
  onSubmit: (data: AssetFormData) => Promise<void>
  className?: string
}

export function AssetForm({ onSubmit, className }: AssetFormProps) {
  const [formData, setFormData] = useState<AssetFormData>({
    name: "",
    code: "",
    description: "",
    totalSupply: "",
    issuer: "",
  })
  const [errors, setErrors] = useState<FieldError[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const getFieldError = (field: string): string | undefined =>
    errors.find((e) => e.field === field)?.message

  const setFieldError = (field: string, message: string) =>
    setErrors((prev) => {
      const filtered = prev.filter((e) => e.field !== field)
      return [...filtered, { field, message }]
    })

  const clearFieldError = (field: string) =>
    setErrors((prev) => prev.filter((e) => e.field !== field))

  const handleChange = (field: keyof AssetFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    clearFieldError(field)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])

    const result = assetFormSchema.safeParse(formData)
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
      const isUnique = await validateAssetCodeUnique(formData.code)
      if (!isUnique) {
        setFieldError("code", "Asset code already exists")
        setIsSubmitting(false)
        return
      }
      await onSubmit(result.data)
    } catch {
      setErrors([{ field: "_form", message: "Failed to create asset. Please try again." }])
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle>Create Asset</CardTitle>
        <CardDescription>Fill in the details to create a new asset on the Stellar network.</CardDescription>
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
              <Label htmlFor="name" className={cn(getFieldError("name") && "text-destructive")}>
                Asset Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="My Token"
                aria-invalid={!!getFieldError("name")}
              />
              {getFieldError("name") && (
                <p className="text-xs text-destructive">{getFieldError("name")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className={cn(getFieldError("code") && "text-destructive")}>
                Asset Code
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
                placeholder="TOKEN"
                maxLength={12}
                aria-invalid={!!getFieldError("code")}
              />
              {getFieldError("code") && (
                <p className="text-xs text-destructive">{getFieldError("code")}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Describe your asset..."
              className="h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="totalSupply" className={cn(getFieldError("totalSupply") && "text-destructive")}>
                Total Supply
              </Label>
              <Input
                id="totalSupply"
                value={formData.totalSupply}
                onChange={(e) => handleChange("totalSupply", e.target.value)}
                placeholder="1000000"
                aria-invalid={!!getFieldError("totalSupply")}
              />
              {getFieldError("totalSupply") && (
                <p className="text-xs text-destructive">{getFieldError("totalSupply")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="issuer">Issuer Public Key</Label>
              <Input
                id="issuer"
                value={formData.issuer || ""}
                onChange={(e) => handleChange("issuer", e.target.value)}
                placeholder="G..."
                aria-invalid={!!getFieldError("issuer")}
              />
              {getFieldError("issuer") && (
                <p className="text-xs text-destructive">{getFieldError("issuer")}</p>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Creating Asset..." : "Create Asset"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
