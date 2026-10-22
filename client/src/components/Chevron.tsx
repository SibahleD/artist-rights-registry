// The one arrow icon. Draws a down chevron and turns it for the other directions, in the colour of the surrounding text.
export type ChevronDir = 'down' | 'up' | 'left' | 'right'

export default function Chevron({ dir = 'down', className = '' }: { dir?: ChevronDir; className?: string }) {
  return (
    <svg className={`chevron chevron-${dir} ${className}`.trim()} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
