import type { CSSProperties, ReactNode } from 'react'

// Grey placeholder shapes that shimmer while a page loads, laid out like the page that is coming (as on YouTube).
// Where a shape makes no sense (a button, a tiny action, a sign-in check) use <Spinner /> instead.

export function Skeleton({ w = '100%', h = 14, round = false, style }: { w?: number | string; h?: number | string; round?: boolean; style?: CSSProperties }) {
  return <span className="skel" aria-hidden="true" style={{ width: w, height: h, borderRadius: round ? '50%' : undefined, ...style }} />
}

export function SkeletonLines({ lines = 3, last = '60%' }: { lines?: number; last?: string }) {
  return (
    <div className="stack tight" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} w={i === lines - 1 ? last : '100%'} />)}
    </div>
  )
}

const Card = ({ children }: { children: ReactNode }) => <div className="card stack skel-card" aria-hidden="true">{children}</div>

const Field = () => <div className="stack tight"><Skeleton w="40%" h={12} /><Skeleton h={38} style={{ borderRadius: 10 }} /></div>

const ReleaseRow = () => (
  <div className="card release skel-release" aria-hidden="true">
    <Skeleton w={72} h={72} style={{ borderRadius: 10, flex: 'none' }} />
    <div className="stack tight" style={{ flex: 1 }}><Skeleton w="70%" h={16} /><Skeleton w="45%" h={12} /></div>
  </div>
)

export type SkeletonVariant = 'list' | 'detail' | 'form' | 'dashboard' | 'text'

export function PageSkeleton({ variant = 'text' }: { variant?: SkeletonVariant }) {
  switch (variant) {
    case 'list':
      return (
        <div className="stack" aria-hidden="true">
          <Skeleton w="35%" h={28} />
          <div className="cards">{Array.from({ length: 6 }, (_, i) => <ReleaseRow key={i} />)}</div>
        </div>
      )
    case 'detail':
      return (
        <div className="stack" aria-hidden="true">
          <Card>
            <div className="row" style={{ gap: 20, alignItems: 'center' }}>
              <Skeleton w={140} h={140} style={{ borderRadius: 14, flex: 'none' }} />
              <div className="stack tight" style={{ flex: 1 }}><Skeleton w="55%" h={28} /><Skeleton w="35%" h={14} /><Skeleton w="25%" h={14} /></div>
            </div>
          </Card>
          <Card><Skeleton w="30%" h={18} /><SkeletonLines lines={4} /></Card>
          <Card><Skeleton w="30%" h={18} /><SkeletonLines lines={3} /></Card>
        </div>
      )
    case 'form':
      return (
        <div className="stack" aria-hidden="true">
          <Skeleton w="30%" h={28} />
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton w="25%" h={18} />
              <div className="grid2"><Field /><Field /><Field /><Field /></div>
            </Card>
          ))}
        </div>
      )
    case 'dashboard':
      return (
        <div className="stack" aria-hidden="true">
          <Skeleton w="30%" h={28} />
          <div className="grid2">{[0, 1, 2, 3].map((i) => <Card key={i}><Skeleton w="40%" h={12} /><Skeleton w="55%" h={26} /></Card>)}</div>
          <Card><Skeleton w="30%" h={18} /><Skeleton h={180} style={{ borderRadius: 12 }} /></Card>
          <Card><SkeletonLines lines={5} /></Card>
        </div>
      )
    default:
      return <SkeletonLines lines={3} last="45%" />
  }
}

// A small turning circle: for places where a skeleton does not fit (inside buttons, short waits, the sign-in check).
export function Spinner({ size = 18, label = 'Loading' }: { size?: number; label?: string }) {
  return <span className="spinner" role="status" aria-label={label} style={{ width: size, height: size }} />
}
