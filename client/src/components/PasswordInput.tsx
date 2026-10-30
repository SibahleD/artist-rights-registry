import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

// A password box with a show/hide button. Use it for every password field so they all behave the same.
// The icons are inline SVG drawn in currentColor, so they always render and follow the text colour.
const svgProps = {
  viewBox: '0 0 24 24',
  width: 18,
  height: 18,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

const EyeIcon = () => (
  <svg {...svgProps}>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = () => (
  <svg {...svgProps}>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575a1 1 0 0 1 0 .696a10.8 10.8 0 0 1-1.444 2.49m-6.41-.679a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 4.446-5.143M2 2l20 20" />
  </svg>
)

export default function PasswordInput(props: Props) {
  const [shown, setShown] = useState(false)
  return (
    <span className="pw-field">
      <input {...props} type={shown ? 'text' : 'password'} />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        title={shown ? 'Hide password' : 'Show password'}
      >
        {shown ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </span>
  )
}
