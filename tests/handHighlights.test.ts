import { describe, expect, test } from 'bun:test'
import { getBombHighlightCardIds } from '../src/game/handHighlights.ts'
import type { Card } from '../src/game/types.ts'

function card(id: number, rank: Card['rank'], value: number, suit: Card['suit'] = 'spade'): Card {
  return { id, rank, value, suit }
}

describe('getBombHighlightCardIds', () => {
  test('highlights all cards in a same-value bomb', () => {
    const hand = [
      card(1, 'A', 14, 'spade'),
      card(2, 'A', 14, 'heart'),
      card(3, 'A', 14, 'diamond'),
      card(4, 'A', 14, 'club'),
      card(5, '7', 7, 'spade'),
    ]

    expect(getBombHighlightCardIds(hand)).toEqual([1, 2, 3, 4])
  })

  test('does not highlight pairs or triples', () => {
    const hand = [
      card(1, 'K', 13, 'spade'),
      card(2, 'K', 13, 'heart'),
      card(3, 'K', 13, 'diamond'),
      card(4, '9', 9, 'club'),
      card(5, '9', 9, 'spade'),
    ]

    expect(getBombHighlightCardIds(hand)).toEqual([])
  })

  test('highlights every card in an extended same-value bomb', () => {
    const hand = [
      card(1, '2', 15, 'spade'),
      card(2, '2', 15, 'heart'),
      card(3, '2', 15, 'diamond'),
      card(4, '2', 15, 'club'),
      card(5, '2', 15, 'spade'),
    ]

    expect(getBombHighlightCardIds(hand)).toEqual([1, 2, 3, 4, 5])
  })

  test('highlights a two-deck rocket', () => {
    const hand = [
      card(1, 'small', 16, 'joker'),
      card(2, 'big', 17, 'joker'),
      card(3, 'small', 16, 'joker'),
      card(4, 'big', 17, 'joker'),
      card(5, '3', 3),
    ]

    expect(getBombHighlightCardIds(hand)).toEqual([1, 2, 3, 4])
  })
})
