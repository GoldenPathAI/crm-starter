import { Label } from "@/app/_ui/Label"

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}

export const Field = ({ label, htmlFor, error, hint, required, children }: FieldProps) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor={htmlFor}>
      {label}
      {required === true ? <span className="ml-0.5 text-danger">*</span> : null}
    </Label>
    {children}
    {error !== undefined && error.length > 0 ? (
      <p className="text-xs font-medium text-danger">{error}</p>
    ) : null}
    {hint !== undefined && hint.length > 0 && (error === undefined || error.length === 0) ? (
      <p className="text-xs text-muted">{hint}</p>
    ) : null}
  </div>
)
