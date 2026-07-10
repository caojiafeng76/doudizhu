import { describe, expect, test } from 'bun:test'
import type { PlayCandidate } from '../src/game/deepseekAI.ts'
import { formatAIAnalysisRecommendation } from '../src/components/aiAnalysisPresentation.ts'

const singleCandidate: PlayCandidate = {
  id: 'play-7',
  cards: [],
  combination: {
    type: 'single',
    mainValue: 7,
    length: 1,
    cardCount: 1,
  },
  labels: ['7'],
}

describe('AI analysis panel helpers', () => {
  test('formats a candidate with its card labels and combination', () => {
    expect(formatAIAnalysisRecommendation(singleCandidate)).toBe('7 / 单张')
  })

  test('formats a missing candidate as a pass recommendation', () => {
    expect(formatAIAnalysisRecommendation(null)).toBe('不出')
  })

  test('allows pointer input for scrolling the analysis panel', async () => {
    const css = await Bun.file(
      new URL('../src/game.css', import.meta.url),
    ).text()
    const panelRule = css.match(/\.ai-analysis-panel\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

    expect(panelRule).toContain('pointer-events: auto;')
  })
})
