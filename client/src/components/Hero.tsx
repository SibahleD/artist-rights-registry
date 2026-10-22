import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Chevron from './Chevron'

// Back link for the top-left corner of a hero (or of any page that has none).
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="hero-back"><Chevron dir="left" />{children}</Link>
}

// Page header: the back link sits in the top-left corner, the rest of the content below it.
// Pass `art` (a cover picture) to lay the content out beside it.
export default function Hero({ back, art, style, centered, children }: { back?: ReactNode; art?: ReactNode; style?: CSSProperties; centered?: boolean; children: ReactNode }) {
  return (
    <div className={`hero${art ? ' hero-art' : ''}${centered ? ' hero-center' : ''}`} style={style}>
      {back}
      <div className="hero-main">
        {art}
        {art ? <div className="hero-text">{children}</div> : children}
      </div>
    </div>
  )
}
