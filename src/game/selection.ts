export function selectCardRange(orderedIds: number[], startId: number, endId: number): number[] {
  const startIndex = orderedIds.indexOf(startId)
  const endIndex = orderedIds.indexOf(endId)

  if (endIndex === -1) return []
  if (startIndex === -1) return [endId]

  const from = Math.min(startIndex, endIndex)
  const to = Math.max(startIndex, endIndex)
  return orderedIds.slice(from, to + 1)
}
