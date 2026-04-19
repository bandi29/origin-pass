export async function anchorPassportHash(
  passportId: string,
  payloadHash: string
): Promise<{ anchored: boolean; reference?: string }> {
  void passportId
  void payloadHash
  // Future extension point for external blockchain anchoring.
  return { anchored: false }
}
