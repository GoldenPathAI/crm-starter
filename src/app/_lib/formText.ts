// The text value of a form field, or "" when the field is missing or holds a file.
export const formText = (formData: FormData, name: string): string => {
  const value = formData.get(name)

  return typeof value === "string" ? value : ""
}
