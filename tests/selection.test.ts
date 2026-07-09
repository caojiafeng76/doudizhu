import { describe, expect, test } from 'bun:test'
import { selectCardRange, toggleCardRangeSelection } from '../src/game/selection.ts'

describe('selectCardRange', () => {
  const orderedIds = [10, 11, 12, 13, 14, 15]

  test('selects every card between the drag start and current card', () => {
    expect(selectCardRange(orderedIds, 11, 14)).toEqual([11, 12, 13, 14])
  })

  test('keeps the same hand order when dragging backward', () => {
    expect(selectCardRange(orderedIds, 14, 11)).toEqual([11, 12, 13, 14])
  })

  test('returns the current card when the drag start is not in the hand', () => {
    expect(selectCardRange(orderedIds, 99, 12)).toEqual([12])
  })
})

describe('toggleCardRangeSelection', () => {
  const orderedIds = [10, 11, 12, 13, 14, 15]

  test('adds the dragged range when any card in the range is unselected', () => {
    expect(toggleCardRangeSelection(orderedIds, [10, 15], 11, 13)).toEqual([10, 11, 12, 13, 15])
  })

  test('removes the dragged range when every card in the range is already selected', () => {
    expect(toggleCardRangeSelection(orderedIds, [10, 11, 12, 13, 15], 11, 13)).toEqual([10, 15])
  })

  test('preserves hand order after toggling', () => {
    expect(toggleCardRangeSelection(orderedIds, [15], 14, 11)).toEqual([11, 12, 13, 14, 15])
  })
})
