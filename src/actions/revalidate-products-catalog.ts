"use server"

import { revalidatePath } from "next/cache"
import { routing } from "@/i18n/routing"

/** Bust RSC cache for the localized products catalog (used after bulk import). */
export async function revalidateProductsCatalog(): Promise<void> {
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/dashboard/products`, "page")
    revalidatePath(`/${locale}/dashboard/products`, "layout")
  }
}
