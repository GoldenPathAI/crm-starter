export { moveDealStage } from "@/lib/crm/store/deals"
export { updateTicketStatus, toggleSubtask } from "@/lib/crm/store/tickets"
export { addActivity } from "@/lib/crm/store/activities"
export type { AddActivityInput } from "@/lib/crm/store/activities"

export { createClient, updateClient, deleteClient } from "@/lib/crm/store/clients"
export type {
  ClientContactInput,
  CreateClientInput,
  UpdateClientPatch,
  DeleteClientResult,
} from "@/lib/crm/store/clients"

export { createPerson, updatePerson, deletePerson, setPrimaryPerson } from "@/lib/crm/store/people"
export type { CreatePersonInput, UpdatePersonInput } from "@/lib/crm/store/people"

