"use server"

import { claimOwnership } from "@/backend/modules/ownership/service"

export type ClaimOwnershipFormInput = {
  tokenOrSerial: string
  ownerIdentifier: string
  ownerName?: string
}

export async function claimOwnershipAction(input: ClaimOwnershipFormInput) {
  return claimOwnership({
    tokenOrSerial: input.tokenOrSerial,
    ownerIdentifier: input.ownerIdentifier,
    ownerName: input.ownerName,
    userId: null,
  })
}
