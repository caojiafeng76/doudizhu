import type { Player } from '../game/types'

interface ResultModalProps {
  players: Player[]
  landlordIndex: number
  winnerId: number
  multiplier: number
  scores: number[]
  roundNumber: number
  onNewRound: () => void
}

export function ResultModal({
  players,
  landlordIndex,
  winnerId,
  multiplier,
  scores,
  roundNumber,
  onNewRound,
}: ResultModalProps) {
  const isLandlordWin = players[winnerId].isLandlord

  return (
    <div className="result-modal-overlay">
      <div className="result-modal">
        <h2>{isLandlordWin ? '🏆 地主胜' : '🎉 农民胜'}</h2>
        <p className="result-subtitle">第 {roundNumber} 局 · 倍数 ×{multiplier}</p>
        <div className="result-scores">
          {players.map(player => {
            const score = scores[player.id]
            const isWinner = player.id === winnerId
            const isLandlord = player.id === landlordIndex
            return (
              <div
                key={player.id}
                className={`result-row ${isLandlord ? 'landlord-row' : ''} ${isWinner ? 'winner-row' : ''}`}
              >
                <span className="player-name">
                  {player.name}
                  {isLandlord && ' [地主]'}
                </span>
                <span className={`score-value ${score > 0 ? 'positive' : 'negative'}`}>
                  {score > 0 ? '+' : ''}{score}
                </span>
              </div>
            )
          })}
        </div>
        <button className="new-round-btn" onClick={onNewRound}>
          下一局
        </button>
      </div>
    </div>
  )
}
