import { Suspense } from "react"
import ProductPassportEditorPage from "./ProductPassportEditorPage"

function EditorFallback() {
  return (
    <div className="min-h-screen animate-pulse bg-[#f6f6f7] px-5 py-8">
      <div className="mx-auto h-64 max-w-2xl rounded-xl bg-white" />
    </div>
  )
}

export default async function ProductPassportEditorRoute({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  return (
    <Suspense fallback={<EditorFallback />}>
      <ProductPassportEditorPage productId={productId} />
    </Suspense>
  )
}
