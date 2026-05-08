/** Shimmer skeleton components for loading states. */

export function BillCardSkeleton() {
  return (
    <div className="bill-row" style={{ cursor: 'default', pointerEvents: 'none' }}>
      <div className="bill-row-top" style={{ marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <span className="sk sk-chip" style={{ width: 80 }} />
          <span className="sk sk-chip" style={{ width: 110 }} />
        </div>
        <span className="sk sk-line--sm" style={{ width: 60 }} />
      </div>
      <div className="sk sk-line sk-line--lg" style={{ width: '80%', marginBottom: 10 }} />
      <div className="sk sk-line" style={{ width: '55%', marginBottom: 4 }} />
      <div className="sk sk-line sk-line--sm" style={{ width: '35%', marginBottom: 14 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className="sk sk-line--sm" style={{ width: '45%' }} />
        <div className="sk sk-line--sm" style={{ width: 48 }} />
      </div>
    </div>
  )
}

export function BillFeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <BillCardSkeleton key={i} />
      ))}
    </>
  )
}

export function DetailPanelSkeleton() {
  return (
    <div className="detail-panel">
      <div className="sk sk-chip" style={{ width: 70, marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: 14 }}>
        <span className="sk sk-chip" style={{ width: 90 }} />
        <span className="sk sk-chip" style={{ width: 120 }} />
      </div>
      <div className="sk sk-line sk-line--lg" style={{ width: '90%' }} />
      <div className="sk sk-line sk-line--lg" style={{ width: '70%', marginBottom: 16 }} />
      <div style={{ background: '#f5f7fb', borderLeft: '4px solid #e4e9f2', padding: '12px 16px', marginBottom: 16, borderRadius: 2 }}>
        <div className="sk sk-line" style={{ width: '95%' }} />
        <div className="sk sk-line" style={{ width: '80%' }} />
        <div className="sk sk-line sk-line--sm" style={{ width: '60%', marginBottom: 0 }} />
      </div>
      <div className="sk sk-line sk-line--sm" style={{ width: '50%' }} />
      <div className="sk sk-line sk-line--sm" style={{ width: '40%', marginBottom: 20 }} />
      <div className="sk sk-line--sm" style={{ width: '100%', height: 1, background: '#e4e9f2', marginBottom: 16 }} />
      <div className="sk sk-line" style={{ width: '70%' }} />
      <div className="sk sk-line" style={{ width: '60%' }} />
      <div className="sk sk-line sk-line--sm" style={{ width: '50%' }} />
    </div>
  )
}

export function AlderCardSkeleton() {
  return (
    <div className="alder-card" style={{ pointerEvents: 'none' }}>
      <div className="sk sk-line--sm" style={{ width: 80, marginBottom: 8 }} />
      <div className="sk sk-line sk-line--lg" style={{ width: '75%', marginBottom: 14 }} />
      <div className="sk sk-line--sm" style={{ width: '90%' }} />
      <div className="sk sk-line--sm" style={{ width: '65%', marginBottom: 14 }} />
      <div className="sk sk-line--sm" style={{ width: 60 }} />
    </div>
  )
}

export function AlderGridSkeleton({ count = 15 }: { count?: number }) {
  return (
    <div className="alders-grid">
      {Array.from({ length: count }, (_, i) => (
        <AlderCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function AlderHeroSkeleton() {
  return (
    <div className="alder-hero">
      <div className="sk sk-line--sm" style={{ width: 200, marginBottom: 20, opacity: 0.4 }} />
      <div className="alder-hero-inner">
        <div className="sk sk-circle" style={{ width: 96, height: 96, flexShrink: 0, opacity: 0.4 }} />
        <div style={{ flex: 1 }}>
          <div className="sk sk-line--xl" style={{ width: '55%', marginBottom: 10, opacity: 0.4 }} />
          <div className="sk sk-line" style={{ width: '35%', marginBottom: 14, opacity: 0.4 }} />
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div className="sk sk-line--sm" style={{ width: 160, opacity: 0.4 }} />
            <div className="sk sk-line--sm" style={{ width: 100, opacity: 0.4 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
