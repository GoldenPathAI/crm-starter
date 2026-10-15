export interface DealFormValues {
  clientId: string
  title: string
  valueCzk: number
  probability: number | null
  expectedClose: string | null
  nextStep: string | null
  offerUrl: string | null
}

// Partial patch behind the deal-detail inline editors: each field commits alone, a
// JSON null clears a nullable column, an absent key leaves it untouched.
export interface DealQuickEditPatch {
  valueCzk?: number
  probability?: number | null
  expectedClose?: string | null
  offerUrl?: string | null
}
