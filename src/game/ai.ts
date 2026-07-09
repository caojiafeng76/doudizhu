import type { Card, Combination, AIDifficulty } from './types'
import { canBeat } from './cardLogic'

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

  const beats = findBeatingPlays(hand, lastPlay)
  if (beats.length === 0) return null

  if (difficulty === 'easy') {
    return beats[Math.floor(Math.random() * beats.length)]
  }

  if (difficulty === 'medium') {
    return beats.reduce((smallest, current) =>
      current.length < smallest.length ? current : smallest
    )
  }

  if (hand.length <= 5 && beats.length > 0) {
    return beats.reduce((biggest, current) =>
      current.length > biggest.length ? current : biggest
    )
  }

  return beats.reduce((smallest, current) =>
    current.length < smallest.length ? current : smallest
  )
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

function findBeatingPlays(hand: Card[], lastPlay: Combination): Card[][] {
  const results: Card[][] = []
  const counts = new Map<number, Card[]>()
  for (const card of hand) {
    const group = counts.get(card.value) || []
    group.push(card)
    counts.set(card.value, group)
  }

  const lastType = lastPlay.type

  if (lastType === 'rocket') return []

  const smallJokers = hand.filter(c => c.suit === 'joker' && c.rank === 'small')
  const bigJokers = hand.filter(c => c.suit === 'joker' && c.rank === 'big')
  if (smallJokers.length >= 2 && bigJokers.length >= 2) {
    results.push([...smallJokers.slice(0, 2), ...bigJokers.slice(0, 2)])
  }

  for (const [, group] of counts) {
    if (group.length >= 4) {
      const bomb: Combination = { type: 'bomb', mainValue: group[0].value, length: group.length, cards: group }
      if (canBeat(bomb, lastPlay)) {
        results.push(group)
      }
    }
  }

  if (lastType === 'bomb') {
    return results
  }

  if (lastType === 'single') {
    for (const [, group] of counts) {
      if (group.length === 1 && group[0].value > lastPlay.mainValue) {
        results.push([group[0]])
      }
    }
  }

  if (lastType === 'pair') {
    for (const [, group] of counts) {
      if (group.length >= 2 && group[0].value > lastPlay.mainValue) {
        results.push(group.slice(0, 2))
      }
    }
  }

  if (lastType === 'triple' || lastType === 'triple_pair') {
    for (const [, group] of counts) {
      if (group.length >= 3 && group[0].value > lastPlay.mainValue) {
        if (lastType === 'triple') {
          results.push(group.slice(0, 3))
        } else {
          const pair = findPair(counts, group[0].value)
          if (pair) {
            results.push([...group.slice(0, 3), ...pair])
          }
        }
      }
    }
  }

  if (lastType === 'straight') {
    const straights = findStraightsOfLength(hand, lastPlay.length, lastPlay.mainValue)
    results.push(...straights)
  }

  if (lastType === 'consecutive_pairs') {
    const pairs = findConsecutivePairsOfLength(hand, lastPlay.length, lastPlay.mainValue)
    results.push(...pairs)
  }

  if (lastType === 'airplane') {
    const airplanes = findAirplanesOfLength(hand, lastPlay.length, lastPlay.mainValue)
    results.push(...airplanes)
  }

  return results
}

function findPair(counts: Map<number, Card[]>, excludeValue: number): Card[] | null {
  for (const [val, group] of counts) {
    if (val !== excludeValue && group.length >= 2) {
      return group.slice(0, 2)
    }
  }
  return null
}

function findStraightsOfLength(hand: Card[], length: number, minValue: number): Card[][] {
  const results: Card[][] = []
  const values = Array.from(new Set(hand.map(c => c.value)))
    .filter(v => v < 15)
    .sort((a, b) => a - b)

  if (values.length < length) return results

  let start = 0
  while (start < values.length) {
    let end = start
    while (end + 1 < values.length && values[end + 1] - values[end] === 1) {
      end++
    }
    const runLength = end - start + 1
    if (runLength >= length) {
      for (let i = 0; i <= runLength - length; i++) {
        const endIdx = i + length - 1
        if (values[endIdx] > minValue) {
          const cards: Card[] = []
          for (let j = i; j <= endIdx; j++) {
            const card = hand.find(c => c.value === values[start + j])
            if (card) cards.push(card)
          }
          if (cards.length === length) results.push(cards)
        }
      }
    }
    start = end + 1
  }
  return results
}

function findConsecutivePairsOfLength(hand: Card[], pairCount: number, minValue: number): Card[][] {
  const results: Card[][] = []
  const pairValues = Array.from(new Set(hand.filter(c => {
    const sameRank = hand.filter(sc => sc.value === c.value)
    return sameRank.length >= 2
  }).map(c => c.value)))
    .filter(v => v < 15)
    .sort((a, b) => a - b)

  if (pairValues.length < pairCount) return results

  let start = 0
  while (start < pairValues.length) {
    let end = start
    while (end + 1 < pairValues.length && pairValues[end + 1] - pairValues[end] === 1) {
      end++
    }
    const runLength = end - start + 1
    if (runLength >= pairCount) {
      for (let i = 0; i <= runLength - pairCount; i++) {
        const endIdx = i + pairCount - 1
        if (pairValues[endIdx] > minValue) {
          const cards: Card[] = []
          for (let j = i; j <= endIdx; j++) {
            const val = pairValues[start + j]
            const pairs = hand.filter(c => c.value === val).slice(0, 2)
            cards.push(...pairs)
          }
          if (cards.length === pairCount * 2) results.push(cards)
        }
      }
    }
    start = end + 1
  }
  return results
}

function findAirplanesOfLength(hand: Card[], tripleCount: number, minValue: number): Card[][] {
  const results: Card[][] = []
  const tripleValues = Array.from(new Set(hand.filter(c => {
    const sameRank = hand.filter(sc => sc.value === c.value)
    return sameRank.length >= 3
  }).map(c => c.value)))
    .filter(v => v < 15)
    .sort((a, b) => a - b)

  if (tripleValues.length < tripleCount) return results

  let start = 0
  while (start < tripleValues.length) {
    let end = start
    while (end + 1 < tripleValues.length && tripleValues[end + 1] - tripleValues[end] === 1) {
      end++
    }
    const runLength = end - start + 1
    if (runLength >= tripleCount) {
      for (let i = 0; i <= runLength - tripleCount; i++) {
        const endIdx = i + tripleCount - 1
        if (tripleValues[endIdx] > minValue) {
          const baseCards: Card[] = []
          for (let j = i; j <= endIdx; j++) {
            const val = tripleValues[start + j]
            const triples = hand.filter(c => c.value === val).slice(0, 3)
            baseCards.push(...triples)
          }
          const wingCandidates = Array.from(new Set(hand.filter(c => {
            const sameRank = hand.filter(sc => sc.value === c.value)
            return sameRank.length >= 2
          }).map(c => c.value)))
            .filter(v => !tripleValues.slice(start + i, start + endIdx + 1).includes(v))
            .filter(v => v < 15)
            .sort((a, b) => a - b)

          const wings = findWingsOfLength(wingCandidates, hand, tripleCount)
          for (const wing of wings) {
            results.push([...baseCards, ...wing])
          }
        }
      }
    }
    start = end + 1
  }
  return results
}

function findWingsOfLength(pairValues: number[], hand: Card[], count: number): Card[][] {
  const results: Card[][] = []
  if (pairValues.length < count) return results

  let start = 0
  while (start < pairValues.length) {
    let end = start
    while (end + 1 < pairValues.length && pairValues[end + 1] - pairValues[end] === 1) {
      end++
    }
    const runLength = end - start + 1
    if (runLength >= count) {
      for (let i = 0; i <= runLength - count; i++) {
        const cards: Card[] = []
        for (let j = i; j < i + count; j++) {
          const val = pairValues[start + j]
          const pairs = hand.filter(c => c.value === val).slice(0, 2)
          cards.push(...pairs)
        }
        if (cards.length === count * 2) results.push(cards)
      }
    }
    start = end + 1
  }
  return results
}
