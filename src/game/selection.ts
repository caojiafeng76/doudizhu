export function selectCardRange(orderedIds: number[], startId: number, endId: number): number[] {
  const startIndex = orderedIds.indexOf(startId)
  const endIndex = orderedIds.indexOf(endId)

  if (endIndex === -1) return []
  if (startIndex === -1) return [endId]

  const from = Math.min(startIndex, endIndex)
  const to = Math.max(startIndex, endIndex)
  return orderedIds.slice(from, to + 1)
}

export function toggleCardRangeSelection(
  orderedIds: number[],
  selectedIds: number[],
  startId: number,
  endId: number
): number[] {
  const range = selectCardRange(orderedIds, startId, endId)
  if (range.length === 0) return selectedIds

  const selectedSet = new Set(selectedIds)
  const rangeSet = new Set(range)
  const shouldRemoveRange = range.every(id => selectedSet.has(id))

  if (shouldRemoveRange) {
    return orderedIds.filter(id => selectedSet.has(id) && !rangeSet.has(id))
  }

  return orderedIds.filter(id => selectedSet.has(id) || rangeSet.has(id))
}
