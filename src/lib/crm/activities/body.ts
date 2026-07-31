// Some timeline bodies were written through JSON layers that left literal "\n"
// two-character sequences in the text. Normalize them back to real newlines before
// rendering.
export const normalizeActivityBody = (body: string): string => body.replace(/\\n/g, "\n")
