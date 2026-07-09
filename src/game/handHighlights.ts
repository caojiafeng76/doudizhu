import type { Card } from './types.ts'

export function getBombHighlightCardIds(hand: Card[]): number[] {
  const highlighted = new Set<number>()
  const cardsByValue = new Map<number, Card[]>()

  for (const card of hand) {
    const group = cardsByValue.get(card.value) ?? []
    group.push(card)
    cardsByValue.set(card.value, group)
  }

  for (const group of cardsByValue.values()) {
    if (group.length >= 4) {
      for (const card of group) {
        highlighted.add(card.id)
      }
    }
  }

  const smallJokers = hand.filter(card => card.suit === 'joker' && card.rank === 'small')
  const bigJokers = hand.filter(card => card.suit === 'joker' && card.rank === 'big')
  if (smallJokers.length >= 2 && bigJokers.length >= 2) {
    for (const card of [...smallJokers, ...bigJokers]) {
      highlighted.add(card.id)
    }
  }

  return hand
    .filter(card => highlighted.has(card.id))
    .map(card => card.id)
}
