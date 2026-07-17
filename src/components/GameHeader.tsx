import type { Card as CardType, AIDifficulty } from '../game/types'
import { Card } from './Card'

interface GameHeaderProps {
  bottomCards: CardType[]
  multiplier: number
  currentPlayerName: string
  roundNumber: number
  aiDifficulty: AIDifficulty
  showBottom: boolean
  musicEnabled: boolean
  onToggleMusic: () => void
}

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

export function GameHeader({
  bottomCards,
  multiplier,
  currentPlayerName,
  roundNumber,
  aiDifficulty,
  showBottom,
  musicEnabled,
  onToggleMusic,
}: GameHeaderProps) {
  return (
    <div className="game-header">
      <div className="header-left">
        <span className="round-number">第 {roundNumber} 局</span>
        <span className="multiplier">×{multiplier}</span>
      </div>
      <div className="header-center">
        {showBottom && (
          <div className="bottom-cards">
            <span className="bottom-cards-label">底牌</span>
            {bottomCards.map(card => (
              <Card key={card.id} card={card} size="small" />
            ))}
          </div>
        )}
      </div>
      <div className="header-right">
        <button
          type="button"
          className={`music-toggle ${musicEnabled ? 'on' : 'off'}`}
          onClick={onToggleMusic}
          aria-label={musicEnabled ? '关闭背景音乐' : '开启背景音乐'}
          aria-pressed={musicEnabled}
          title={musicEnabled ? '背景音乐：开' : '背景音乐：关'}
        >
          {musicEnabled ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 5v8.55A4 4 0 1 0 14 17V9h3a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 0z"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 5v8.55A4 4 0 1 0 14 17V9h3a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 0z"
              />
              <path
                fill="currentColor"
                d="M3.7 3.3a1 1 0 0 0-1.4 1.4l16 16a1 1 0 0 0 1.4-1.4z"
              />
            </svg>
          )}
        </button>
        <span className="current-turn">
          <span className="turn-indicator" />
          {currentPlayerName}
        </span>
        <span className="difficulty-label">难度：{DIFFICULTY_LABELS[aiDifficulty]}</span>
      </div>
    </div>
  )
}
