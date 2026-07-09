import type { Card, Combination, AIDifficulty } from './types'
import { findValidPlays } from './cardLogic'
import { sortPlaysByStrength } from './aiStrategy.ts'

export function evaluateHandStrength(hand: Card[]): number {
  let score = 0
  const counts = new Map<number, number>()

  for (const card of hand) {
    counts.set(card.value, (counts.get(card.value) || 0) + 1)
  }

  for (const [, count] of counts) {
    if (count === 4) score += 8
    else if (count === 3) score += 4
    else if (count === 2) score += 1
  }

  const smallJokerCount = hand.filter(c => c.suit === 'joker' && c.rank === 'small').length
  const bigJokerCount = hand.filter(c => c.suit === 'joker' && c.rank === 'big').length
  const hasRocket = smallJokerCount >= 2 && bigJokerCount >= 2
  if (hasRocket) score += 10

  for (const card of hand) {
    if (card.rank === '2') score += 2
    if (card.suit === 'joker') score += 3
  }

  return score
}

export function decideBid(hand: Card[], currentHighestBid: number, difficulty: AIDifficulty): number {
  const strength = evaluateHandStrength(hand)

  let threshold = 0
  switch (difficulty) {
    case 'easy': threshold = 12; break
    case 'medium': threshold = 10; break
    case 'hard': threshold = 8; break
  }

  if (strength < threshold) return 0

  const maxBid = Math.min(3, Math.floor(strength / 4))

  if (maxBid <= currentHighestBid) return 0

  if (difficulty === 'easy') {
    return currentHighestBid + 1
  }

  return maxBid
}

export function aiPlayTurn(
  hand: Card[],
  lastPlay: Combination | null,
  _isLandlord: boolean,
  difficulty: AIDifficulty
): Card[] | null {
  if (!lastPlay) {
    return openPlay(hand, difficulty)
  }

  const beats = sortPlaysByStrength(findValidPlays(hand, lastPlay))
  if (beats.length === 0) return null

  if (difficulty === 'easy') {
    return beats[Math.floor(Math.random() * beats.length)]
  }

  if (difficulty === 'medium') return beats[0]

  const winningPlay = beats.find(play => play.length === hand.length)
  if (winningPlay) return winningPlay

  if (hand.length <= 5 && beats.length > 0) {
    return beats.reduce((biggest, current) =>
      current.length > biggest.length ? current : biggest
    )
  }

  return beats[0]
}

function openPlay(hand: Card[], difficulty: AIDifficulty): Card[] {
  const counts = new Map<number, Card[]>()
  for (const card of hand) {
    const group = counts.get(card.value) || []
    group.push(card)
    counts.set(card.value, group)
  }

  if (hand.length <= 3) {
    const best = Array.from(counts.values())
      .sort((a, b) => b[0].value - a[0].value)[0]
    return best
  }

  if (difficulty === 'easy') {
    const singles = Array.from(counts.entries())
      .filter(([, g]) => g.length === 1)
      .sort((a, b) => a[0] - b[0])
    if (singles.length > 0) return singles[0][1]
    const values = Array.from(counts.values())
    return values[Math.floor(Math.random() * values.length)].slice(0, 1)
  }

  const singles = Array.from(counts.entries())
    .filter(([, g]) => g.length === 1)
    .sort((a, b) => a[0] - b[0])

  if (singles.length >= 5) {
    const straight = findSmallestStraight(hand)
    if (straight) return straight
  }

  if (singles.length > 0) {
    return singles[0][1]
  }

  const pairs = Array.from(counts.entries())
    .filter(([, g]) => g.length === 2)
    .sort((a, b) => a[0] - b[0])

  if (pairs.length > 0) {
    return pairs[0][1]
  }

  const groups = Array.from(counts.values()).sort((a, b) => a.length - b.length)
  return groups[0]
}

function findSmallestStraight(hand: Card[]): Card[] | null {
  const values = Array.from(new Set(hand.map(c => c.value)))
    .filter(v => v < 15)
    .sort((a, b) => a - b)

  if (values.length < 5) return null

  let bestStart = -1
  let bestLength = 0

  let start = 0
  while (start < values.length) {
    let end = start
    while (end + 1 < values.length && values[end + 1] - values[end] === 1) {
      end++
    }
    const len = end - start + 1
    if (len >= 5 && len > bestLength) {
      bestStart = start
      bestLength = len
    }
    start = end + 1
  }

  if (bestStart === -1) return null

  const cards: Card[] = []
  for (let i = bestStart; i < bestStart + bestLength; i++) {
    const card = hand.find(c => c.value === values[i])
    if (card) cards.push(card)
  }

  return cards.length === bestLength ? cards : null
}
