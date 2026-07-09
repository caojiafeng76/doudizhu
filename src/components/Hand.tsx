import { useMemo } from 'react'
import type { Card as CardType } from '../game/types'
import { Card } from './Card'

interface HandProps {
  cards: CardType[]
  selectedCardIds: number[]
  onCardClick?: (cardId: number) => void
  isHuman: boolean
}

const HAND_CARD_WIDTH = 76
const HAND_MAX_WIDTH = 1040
const HAND_CARD_GAP = 40
const HAND_WRAP_THRESHOLD = 30
const HAND_WRAP_COLUMNS = 17

export function Hand({ cards, selectedCardIds, onCardClick, isHuman }: HandProps) {
  const { cardWidth, marginLeft, rowCount } = useMemo(() => {
    const cardWidth = HAND_CARD_WIDTH
    const rowCount = cards.length > HAND_WRAP_THRESHOLD ? Math.ceil(cards.length / HAND_WRAP_COLUMNS) : 1
    const cardsPerRow = rowCount > 1 ? Math.ceil(cards.length / rowCount) : cards.length
    if (cardsPerRow <= 1) return { cardWidth, marginLeft: 0, rowCount }

    const step = Math.min(HAND_CARD_GAP, (HAND_MAX_WIDTH - cardWidth) / (cardsPerRow - 1))
    return { cardWidth, marginLeft: Math.floor(step - cardWidth), rowCount }
  }, [cards.length])

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
          onClick={() => onCardClick?.(card.id)}
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
