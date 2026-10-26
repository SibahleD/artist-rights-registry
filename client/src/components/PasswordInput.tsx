import { useState, type InputHTMLAttributes } from 'react'
import eyeIco from '../assets/ico/eye.svg'
import eyeOffIco from '../assets/ico/eye-off.svg'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

// A password box with a show/hide button. Use it for every password field so they all behave the same.
// The icon is drawn as a mask, so it takes the text colour and stays visible on light and dark backgrounds.
export default function PasswordInput(props: Props) {
  const [shown, setShown] = useState(false)
  const icon = `url(${shown ? eyeOffIco : eyeIco})`
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
        <span className="pw-icon" style={{ WebkitMaskImage: icon, maskImage: icon }} />
      </button>
    </span>
  )
}
