import type { Card, Combination } from './types.ts'
import { identifyCombination } from './cardLogic.ts'

export interface PlayCandidateSummary {
  combination: {
    type: Combination['type']
    mainValue: number
    length: number
    cardCount: number
  }
}

export function comparePlayCandidateStrength(a: PlayCandidateSummary, b: PlayCandidateSummary): number {
  const powerDiff = candidatePowerCost(a) - candidatePowerCost(b)
  if (powerDiff !== 0) return powerDiff

  const typeDiff = candidateTypeRank(a) - candidateTypeRank(b)
  if (typeDiff !== 0) return typeDiff

  const valueDiff = a.combination.mainValue - b.combination.mainValue
  if (valueDiff !== 0) return valueDiff

  return a.combination.cardCount - b.combination.cardCount
}

export function sortPlaysByStrength(plays: Card[][]): Card[][] {
  return [...plays].sort((a, b) => {
    const aCombination = identifyCombination(a)
    const bCombination = identifyCombination(b)
    if (!aCombination && !bCombination) return 0
    if (!aCombination) return 1
    if (!bCombination) return -1

    return comparePlayCandidateStrength(
      {
        combination: {
          type: aCombination.type,
          mainValue: aCombination.mainValue,
          length: aCombination.length,
          cardCount: a.length,
        },
      },
      {
        combination: {
          type: bCombination.type,
          mainValue: bCombination.mainValue,
          length: bCombination.length,
          cardCount: b.length,
        },
      }
    )
  })
}

export function filterPlaysPreservingBombs(
  hand: Card[],
  plays: Card[][],
): Card[][] {
  const handCounts = countCardValues(hand)

  return plays.filter((play) => {
    const playCounts = countCardValues(play)

    for (const [value, handCount] of handCounts) {
      const playCount = playCounts.get(value) ?? 0
      if (handCount >= 4 && playCount > 0 && playCount < handCount) {
        return false
      }
    }

    return true
  })
}

function countCardValues(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const card of cards) {
    counts.set(card.value, (counts.get(card.value) ?? 0) + 1)
  }
  return counts
}

function candidatePowerCost(candidate: PlayCandidateSummary): number {
  if (candidate.combination.type === 'rocket') return 3
  if (candidate.combination.type === 'bomb') return 2
  if (candidate.combination.mainValue >= 15) return 1
  return 0
}

function candidateTypeRank(candidate: PlayCandidateSummary): number {
  switch (candidate.combination.type) {
    case 'straight': return 0
    case 'consecutive_pairs': return 1
    case 'single': return 2
    case 'pair': return 3
    case 'triple': return 4
    case 'triple_pair': return 5
    case 'airplane': return 6
    case 'bomb': return 7
    case 'rocket': return 8
  }
}
