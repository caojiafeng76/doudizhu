interface BidPanelProps {
  currentBid: number
  onBid: (bid: number) => void
  disabled: boolean
}

export function BidPanel({ currentBid, onBid, disabled }: BidPanelProps) {
  const options = [1, 2, 3].filter(b => b > currentBid)

  if (disabled) return null

  return (
    <div className="bid-panel">
      <span className="bid-prompt">选择叫分</span>
      <div className="bid-buttons">
        {options.map(bid => (
          <button
            key={bid}
            className={`bid-btn bid-${bid}`}
            onClick={() => onBid(bid)}
          >
            {bid}分
          </button>
        ))}
        <button
          className="bid-btn bid-pass"
          onClick={() => onBid(0)}
        >
          不叫
        </button>
      </div>
    </div>
  )
}
