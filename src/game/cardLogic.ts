import type { Card, Combination } from './types'

function countByValue(cards: Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>()
  for (const card of cards) {
    const existing = map.get(card.value) || []
    existing.push(card)
    map.set(card.value, existing)
  }
  return map
}

function isConsecutive(values: number[], minLength: number, excludeValues: number[]): boolean {
  if (values.length < minLength) return false
  const sorted = [...values].sort((a, b) => a - b)
  for (const v of sorted) {
    if (excludeValues.includes(v)) return false
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] !== 1) return false
  }
  return true
}

export function identifyCombination(cards: Card[]): Combination | null {
  const n = cards.length
  if (n === 0) return null

  const counts = countByValue(cards)
  const values = Array.from(counts.keys())
  const groups = Array.from(counts.values())
  const smallJokers = cards.filter(c => c.suit === 'joker' && c.rank === 'small')
  const bigJokers = cards.filter(c => c.suit === 'joker' && c.rank === 'big')

  if (n === 1) {
    return { type: 'single', mainValue: cards[0].value, length: 1, cards }
  }

  if (n === 2) {
    if (values.length === 1) {
      return { type: 'pair', mainValue: values[0], length: 1, cards }
    }
    return null
  }

  if (n === 4 && smallJokers.length === 2 && bigJokers.length === 2) {
    return { type: 'rocket', mainValue: 100, length: 4, cards }
  }

  if (n === 3 && values.length === 1) {
    return { type: 'triple', mainValue: values[0], length: 1, cards }
  }

  if (n === 5 && values.length === 2) {
    const threeGroup = groups.find(g => g.length === 3)
    const pairGroup = groups.find(g => g.length === 2)
    if (threeGroup && pairGroup) {
      return { type: 'triple_pair', mainValue: threeGroup[0].value, length: 1, cards }
    }
    return null
  }

  if (n >= 5 && values.length === n) {
    if (isConsecutive(values, 5, [15, 16, 17])) {
      return { type: 'straight', mainValue: Math.max(...values), length: n, cards }
    }
    return null
  }

  if (n >= 6 && n % 2 === 0) {
    const pairCount = n / 2
    if (values.length === pairCount && groups.every(g => g.length === 2)) {
      if (isConsecutive(values, 3, [15, 16, 17])) {
        return { type: 'consecutive_pairs', mainValue: Math.max(...values), length: pairCount, cards }
      }
    }
  }

  if (n >= 9) {
    const tripleValues: number[] = []
    const pairValues: number[] = []
    let valid = true

    for (const [val, group] of counts) {
      if (group.length === 3) tripleValues.push(val)
      else if (group.length === 2) pairValues.push(val)
      else { valid = false; break }
    }

    if (valid && tripleValues.length >= 3 && tripleValues.length === pairValues.length) {
      const sortedTriples = [...tripleValues].sort((a, b) => a - b)
      if (isConsecutive(sortedTriples, 3, [15, 16, 17])) {
        const sortedPairs = [...pairValues].sort((a, b) => a - b)
        if (isConsecutive(sortedPairs, 3, [15, 16, 17])) {
          const minTriple = sortedTriples[0]
          return { type: 'airplane', mainValue: minTriple, length: tripleValues.length, cards }
        }
      }
    }
  }

  if (n >= 4 && values.length === 1) {
    return { type: 'bomb', mainValue: values[0], length: n, cards }
  }

  return null
}

export function canBeat(current: Combination, target: Combination): boolean {
  if (current.type === 'rocket') return true
  if (target.type === 'rocket') return false

  if (current.type === 'bomb') {
    if (target.type === 'bomb') {
      if (current.length !== target.length) return current.length > target.length
      return current.mainValue > target.mainValue
    }
    return true
  }

  if (target.type === 'bomb') return false

  if (current.type !== target.type) return false

  if (current.length !== target.length) return false

  return current.mainValue > target.mainValue
}

export function findValidPlays(hand: Card[], lastPlay: Combination | null): Card[][] {
  if (!lastPlay) return generateAllPlays(hand)

  const results: Card[][] = []
  const counts = countByValue(hand)

  if (lastPlay.type === 'rocket') return []

  const smallJokers = hand.filter(c => c.suit === 'joker' && c.rank === 'small')
  const bigJokers = hand.filter(c => c.suit === 'joker' && c.rank === 'big')
  if (smallJokers.length >= 2 && bigJokers.length >= 2) {
    results.push([...smallJokers.slice(0, 2), ...bigJokers.slice(0, 2)])
  }

  if (lastPlay.type === 'bomb') {
    for (const [, group] of counts) {
      if (group.length >= 4) {
        const bomb = identifyCombination(group)
        if (bomb && canBeat(bomb, lastPlay)) {
          results.push(group)
        }
      }
    }
    return results
  }

  const allPlays = generateAllPlays(hand)
  for (const play of allPlays) {
    const comb = identifyCombination(play)
    if (comb && canBeat(comb, lastPlay)) {
      results.push(play)
    }
  }

  return results
}

function generateAllPlays(hand: Card[]): Card[][] {
  const results: Card[][] = []
  const counts = countByValue(hand)

  for (const [, group] of counts) {
    results.push([group[0]])
  }

  for (const [, group] of counts) {
    if (group.length >= 2) results.push(group.slice(0, 2))
    if (group.length >= 3) {
      results.push(group.slice(0, 3))
      const pairs = findPairs(counts, group[0].value)
      if (pairs.length > 0) {
        results.push([...group.slice(0, 3), ...pairs[0]])
      }
    }
    if (group.length >= 4) {
      results.push(group)
    }
  }

  results.push(...findStraights(counts))
  results.push(...findConsecutivePairs(counts))
  results.push(...findAirplanes(counts))

  const smallJokers = hand.filter(c => c.suit === 'joker' && c.rank === 'small')
  const bigJokers = hand.filter(c => c.suit === 'joker' && c.rank === 'big')
  if (smallJokers.length >= 2 && bigJokers.length >= 2) {
    results.push([...smallJokers.slice(0, 2), ...bigJokers.slice(0, 2)])
  }

  return results
}

function findPairs(counts: Map<number, Card[]>, excludeValue: number): Card[][] {
  const result: Card[][] = []
  for (const [val, group] of counts) {
    if (val !== excludeValue && group.length >= 2) {
      result.push(group.slice(0, 2))
    }
  }
  return result
}

function findStraights(counts: Map<number, Card[]>): Card[][] {
  const results: Card[][] = []
  const values = Array.from(counts.keys())
    .filter(v => v < 15)
    .sort((a, b) => a - b)

  if (values.length < 5) return results

  let start = 0
  while (start < values.length) {
    let end = start
    while (end + 1 < values.length && values[end + 1] - values[end] === 1) {
      end++
    }
    const runLength = end - start + 1
    if (runLength >= 5) {
      for (let len = 5; len <= runLength; len++) {
        for (let i = 0; i <= runLength - len; i++) {
          const cards: Card[] = []
          for (let j = i; j < i + len; j++) {
            cards.push(counts.get(values[start + j])![0])
          }
          results.push(cards)
        }
      }
    }
    start = end + 1
  }
  return results
}

function findConsecutivePairs(counts: Map<number, Card[]>): Card[][] {
  const results: Card[][] = []
  const pairValues = Array.from(counts.entries())
    .filter(([, g]) => g.length >= 2)
    .map(([v]) => v)
    .filter(v => v < 15)
    .sort((a, b) => a - b)

  if (pairValues.length < 3) return results

  let start = 0
  while (start < pairValues.length) {
    let end = start
    while (end + 1 < pairValues.length && pairValues[end + 1] - pairValues[end] === 1) {
      end++
    }
    const runLength = end - start + 1
    if (runLength >= 3) {
      for (let len = 3; len <= runLength; len++) {
        for (let i = 0; i <= runLength - len; i++) {
          const cards: Card[] = []
          for (let j = i; j < i + len; j++) {
            cards.push(...counts.get(pairValues[start + j])!.slice(0, 2))
          }
          results.push(cards)
        }
      }
    }
    start = end + 1
  }
  return results
}

function findAirplanes(counts: Map<number, Card[]>): Card[][] {
  const results: Card[][] = []
  const tripleValues = Array.from(counts.entries())
    .filter(([, g]) => g.length >= 3)
    .map(([v]) => v)
    .filter(v => v < 15)
    .sort((a, b) => a - b)

  if (tripleValues.length < 3) return results

  let start = 0
  while (start < tripleValues.length) {
    let end = start
    while (end + 1 < tripleValues.length && tripleValues[end + 1] - tripleValues[end] === 1) {
      end++
    }
    const runLength = end - start + 1
    if (runLength >= 3) {
      for (let len = 3; len <= runLength; len++) {
        for (let i = 0; i <= runLength - len; i++) {
          const baseCards: Card[] = []
          const tripleVals: number[] = []
          for (let j = i; j < i + len; j++) {
            const val = tripleValues[start + j]
            baseCards.push(...counts.get(val)!.slice(0, 3))
            tripleVals.push(val)
          }
          const wings = findWings(counts, tripleVals, len)
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

function findWings(counts: Map<number, Card[]>, excludeValues: number[], wingCount: number): Card[][] {
  const results: Card[][] = []
  const pairValues = Array.from(counts.entries())
    .filter(([v, g]) => g.length >= 2 && !excludeValues.includes(v))
    .map(([v]) => v)
    .filter(v => v < 15)
    .sort((a, b) => a - b)

  if (pairValues.length < wingCount) return results

  let start = 0
  while (start < pairValues.length) {
    let end = start
    while (end + 1 < pairValues.length && pairValues[end + 1] - pairValues[end] === 1) {
      end++
    }
    const runLength = end - start + 1
    if (runLength >= wingCount) {
      for (let len = wingCount; len <= runLength; len++) {
        for (let i = 0; i <= runLength - len; i++) {
          const cards: Card[] = []
          for (let j = i; j < i + len; j++) {
            cards.push(...counts.get(pairValues[start + j])!.slice(0, 2))
          }
          results.push(cards)
        }
      }
    }
    start = end + 1
  }
  return results
}
