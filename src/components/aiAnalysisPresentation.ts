import type { PlayCandidate } from '../game/deepseekAI.ts'

const COMBINATION_LABELS: Record<PlayCandidate['combination']['type'], string> =
  {
    single: '单张',
    pair: '对子',
    triple: '三张',
    triple_pair: '三带二',
    straight: '顺子',
    consecutive_pairs: '连对',
    airplane: '飞机',
    bomb: '炸弹',
    rocket: '火箭',
  }

export function formatAIAnalysisRecommendation(
  candidate: PlayCandidate | null,
): string {
  return candidate
    ? `${candidate.labels.join(' ')} / ${COMBINATION_LABELS[candidate.combination.type]}`
    : '不出'
}
