export const areEntitlementRefsEqual = (
    a?: { id?: string | null }[] | null,
    b?: { id?: string | null }[]
): boolean => {
    const arrA = a ?? []
    const arrB = b ?? []

    const counts = new Map<string, number>()
    let validCountA = 0
    let validCountB = 0

    for (let i = 0; i < arrA.length; i++) {
        const id = arrA[i].id
        if (id) {
            counts.set(id, (counts.get(id) || 0) + 1)
            validCountA++
        }
    }

    for (let i = 0; i < arrB.length; i++) {
        const id = arrB[i].id
        if (id) {
            const count = counts.get(id)
            if (!count) return false
            counts.set(id, count - 1)
            validCountB++
        }
    }

    return validCountA === validCountB
}

export const areJsonEqual = (a: unknown, b: unknown): boolean => {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}
