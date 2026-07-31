import { customAlphabet } from "nanoid"

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
const generate = customAlphabet(alphabet, 16)

export const createId = (prefix: string): string => `${prefix}_${generate()}`
