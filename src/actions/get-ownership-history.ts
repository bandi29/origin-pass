"use server"

import { getOwnershipByOwner } from "@/backend/modules/ownership/service"

export async function getOwnershipHistoryAction(ownerIdentifier: string) {
  return getOwnershipByOwner(ownerIdentifier)
}
