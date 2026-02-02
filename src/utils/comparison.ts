export const areEntitlementRefsEqual = (
    a?: { id?: string | null }[] | null,
    b?: { id?: string | null }[]
): boolean => {
    const idsA = (a ?? [])
        .map((x) => x.id ?? undefined)
        .filter(Boolean)
        .slice()
        .sort()
    const idsB = (b ?? [])
        .map((x) => x.id ?? undefined)
        .filter(Boolean)
        .slice()
        .sort()
    if (idsA.length !== idsB.length) return false
    return idsA.every((val, idx) => val === idsB[idx])
}

export const areJsonEqual = (a: unknown, b: unknown): boolean => {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}
