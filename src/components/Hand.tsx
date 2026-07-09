import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card as CardType } from '../game/types'
import { getBombHighlightCardIds } from '../game/handHighlights.ts'
import { selectCardRange, toggleCardRangeSelection } from '../game/selection.ts'
import { Card } from './Card'

interface HandProps {
  cards: CardType[]
  selectedCardIds: number[]
  onCardClick?: (cardId: number) => void
  onCardSelectionChange?: (cardIds: number[]) => void
  onCardContextPlay?: (cardId: number) => void
  isHuman: boolean
}

const HAND_CARD_WIDTH = 76
const HAND_MAX_WIDTH = 1040
const HAND_CARD_GAP = 40
const HAND_WRAP_THRESHOLD = 30
const HAND_WRAP_COLUMNS = 17

export function Hand({
  cards,
  selectedCardIds,
  onCardClick,
  onCardSelectionChange,
  onCardContextPlay,
  isHuman,
}: HandProps) {
  const [dragStartId, setDragStartId] = useState<number | null>(null)
  const dragMovedRef = useRef(false)
  const dragSelectionSnapshotRef = useRef<number[]>([])
  const { cardWidth, marginLeft, rowCount } = useMemo(() => {
    const cardWidth = HAND_CARD_WIDTH
    const rowCount = cards.length > HAND_WRAP_THRESHOLD ? Math.ceil(cards.length / HAND_WRAP_COLUMNS) : 1
    const cardsPerRow = rowCount > 1 ? Math.ceil(cards.length / rowCount) : cards.length
    if (cardsPerRow <= 1) return { cardWidth, marginLeft: 0, rowCount }

    const step = Math.min(HAND_CARD_GAP, (HAND_MAX_WIDTH - cardWidth) / (cardsPerRow - 1))
    return { cardWidth, marginLeft: Math.floor(step - cardWidth), rowCount }
  }, [cards.length])
  const orderedCardIds = useMemo(() => cards.map(card => card.id), [cards])
  const bombHighlightCardIds = useMemo(() => (
    isHuman ? new Set(getBombHighlightCardIds(cards)) : new Set<number>()
  ), [cards, isHuman])

  useEffect(() => {
    if (dragStartId === null) return

    const stopDrag = () => {
      setDragStartId(null)
      window.setTimeout(() => {
        dragMovedRef.current = false
      }, 0)
    }

    window.addEventListener('mouseup', stopDrag)
    return () => window.removeEventListener('mouseup', stopDrag)
  }, [dragStartId])

  const handleCardMouseDown = (cardId: number, button: number) => {
    if (button !== 0) return
    setDragStartId(cardId)
    dragMovedRef.current = false
    dragSelectionSnapshotRef.current = selectedCardIds
  }

  const handleCardMouseEnter = (cardId: number) => {
    if (dragStartId === null) return
    const range = selectCardRange(orderedCardIds, dragStartId, cardId)
    dragMovedRef.current = range.length > 1 || range[0] !== dragStartId
    onCardSelectionChange?.(
      toggleCardRangeSelection(orderedCardIds, dragSelectionSnapshotRef.current, dragStartId, cardId)
    )
  }

  const handleCardClick = (cardId: number) => {
    if (dragMovedRef.current) return
    onCardClick?.(cardId)
  }

  if (!isHuman) {
    return (
      <div className="ai-hand">
        <div className="mini-cards">
          {cards.slice(0, Math.min(cards.length, 12)).map((_, i) => (
            <div key={i} className="mini-card" />
          ))}
        </div>
        <span className="card-count">{cards.length}张</span>
      </div>
    )
  }

  return (
    <div className={`human-hand ${rowCount > 1 ? 'wrapped' : ''}`}>
      {cards.map((card, i) => (
        <Card
          key={card.id}
          card={card}
          selected={selectedCardIds.includes(card.id)}
          highlight={bombHighlightCardIds.has(card.id) ? 'bomb' : undefined}
          onClick={() => handleCardClick(card.id)}
          onMouseDown={event => handleCardMouseDown(card.id, event.button)}
          onMouseEnter={() => handleCardMouseEnter(card.id)}
          onContextMenu={event => {
            event.preventDefault()
            onCardContextPlay?.(card.id)
          }}
          style={{
            width: `${cardWidth}px`,
            marginLeft: i % Math.ceil(cards.length / rowCount) === 0 ? 0 : `${marginLeft}px`,
            flexShrink: 0,
            zIndex: i,
          }}
        />
      ))}
    </div>
  )
}
