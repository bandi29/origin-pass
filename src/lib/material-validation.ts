export interface MaterialEntry {
    material: string
    percentage: number
}

export function validateMaterialComposition(entries: MaterialEntry[]): {
    valid: boolean
    total: number
    error?: string
} {
    if (entries.length === 0) {
        return { valid: false, total: 0, error: "Add at least one material" }
    }

    const total = entries.reduce((sum, e) => sum + (e.percentage || 0), 0)

    if (total !== 100) {
        return {
            valid: false,
            total,
            error: total < 100
                ? `Material percentages must total 100% (currently ${total}%)`
                : `Material percentages exceed 100% (currently ${total}%)`,
        }
    }

    const hasEmptyMaterial = entries.some((e) => !e.material?.trim())
    if (hasEmptyMaterial) {
        return { valid: false, total, error: "All materials must have a name" }
    }

    return { valid: true, total }
}
