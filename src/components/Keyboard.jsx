import { keyStateToClass } from '../lib/keyboardLogic'

// The on-screen keypad. It replaces the text input on the play screens: with
// no <input> anywhere on the page nothing is focusable, so the mobile OS
// keyboard never opens and every key the player can press is one we control
// and can colour.
//
// All four rows show always. Digits and the hyphen are in the bank ("67",
// "l8r", "w00t", "binge-watch"), and revealing that row only when the word
// needs it would hand over most of the answer.
//
// Colours are the feedback palette, never the era accent —
// claude.md fixes those three as a legibility convention inside any skin,
// and the Brainrot accent is a gradient that doesn't behave as a flat key
// fill anyway.
const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '-'],
  ['enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'back'],
]

const LABELS = { enter: 'Enter', back: '⌫' }
const ARIA = { enter: 'Submit guess', back: 'Delete letter' }

export default function Keyboard({
  keyStates = {},
  onKey,
  onEnter,
  onBackspace,
  disabled = false,
  rejection = null,
  press = null,
}) {
  function handlePress(key) {
    if (disabled) return
    if (key === 'enter') onEnter()
    else if (key === 'back') onBackspace()
    else onKey(key)
  }

  return (
    <div className="keyboard" data-disabled={disabled ? 'true' : undefined}>
      {ROWS.map((row, r) => (
        <div className="keyboard__row" key={r}>
          {row.map((key) => {
            const wide = key === 'enter' || key === 'back'
            const dead = !wide && keyStates[key] === 'grey'
            const shaking = rejection?.key === key
            const pressed = !shaking && press?.key === key
            return (
              <button
                // Remounting a key restarts its animation, so pressing the
                // same key twice in a row animates both times. Same trick
                // serves the rejection shake and the press pop; a key is only
                // ever doing one of the two (see useGuessInput), so it takes
                // one nonce or the other, never both.
                key={shaking ? `${key}-r${rejection.nonce}` : pressed ? `${key}-p${press.nonce}` : key}
                type="button"
                className={[
                  'key',
                  wide ? 'key--wide' : keyStateToClass(keyStates[key]),
                  dead ? 'key--dead' : '',
                  shaking ? 'key--rejected' : '',
                  pressed ? 'key--pressed' : '',
                ].filter(Boolean).join(' ')}
                // aria-disabled, not disabled: a disabled button fires no
                // click at all, so a tap would be met with silence — the
                // "is this thing broken?" failure. Enabled, the press still
                // reaches onKey, which rejects it visibly.
                aria-disabled={dead || undefined}
                aria-label={ARIA[key]}
                // Keys never take focus. Otherwise the last-tapped key stays
                // focused and a physical Enter both activates it and fires
                // the window listener in useGuessInput — one press, two
                // guesses. Touch still produces a click after this.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePress(key)}
              >
                {LABELS[key] ?? key.toUpperCase()}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
