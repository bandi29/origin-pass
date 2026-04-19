export async function syncIntegrationEvent(input: {
  provider: "shopify" | "woocommerce" | "erp" | "custom"
  event: string
  payload: unknown
}) {
  void input
  // Placeholder for async integration workers / queue publishing.
  return { accepted: true }
}
