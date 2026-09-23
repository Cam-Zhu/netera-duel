import { useCallback, useEffect, useRef, useState } from 'react'

// The row being typed. The play screens own the guess list and the submit;
// this owns the letters in between, so Guess and SoloPlay don't each carry
// their own copy of it.
//
// It also listens for a physical keyboard, which matters more than it looks:
// the on-screen keypad replaced the <input>, so without this there is
// nothing to type into on a desktop and the app is mouse-only.
//
// Same character set the old input's filter allowed — letters, digits and
// the hyphen, covering "67", "l8r" and "binge-watch".
const TYPEABLE = /^[a-z0-9-]$/

// How long the "you've ruled that out" line and its shake stay up.
const REJECT_MS = 1200

// How long the "wrong length" line stays up. Longer than the row's shake —
// the shake says something was refused, the line says why.
const SHORTFALL_MS = 1600

// Just past the key-press animation in tokens.css. The press is cleared
// rather than left set so a key can't replay its pop later, when some
// unrelated state change happens to remount it.
const PRESS_MS = 180

export function useGuessInput({ wordLength, active, onSubmit, keyStates = {} }) {
  const [input, setInput] = useState('')
  // The last blocked press, or null. The nonce lets the same key be
  // rejected twice in a row and still replay its shake.
  const [rejection, setRejection] = useState(null)
  // The last accepted press, or null — what the keypad pops. Tracked here
  // rather than left to CSS :active because a press can also arrive from a
  // physical keyboard, which never touches the button at all.
  const [press, setPress] = useState(null)
  // The last submit refused for being the wrong length, or null. Bare nonce:
  // there's only one thing it can mean, and the screens write the line.
  const [shortfall, setShortfall] = useState(null)
  const rejectTimer = useRef(null)
  const pressTimer = useRef(null)
  const shortfallTimer = useRef(null)

  // The window listener below is bound once per handler identity, not per
  // keystroke, so it reads everything changeable through this ref rather
  // than closing over a render's values and going stale.
  const latest = useRef(null)
  latest.current = { input, wordLength, active, onSubmit, keyStates }

  const reject = useCallback((char) => {
    setRejection((prev) => ({ key: char, nonce: (prev?.nonce ?? 0) + 1 }))
    clearTimeout(rejectTimer.current)
    rejectTimer.current = setTimeout(() => setRejection(null), REJECT_MS)
  }, [])

  const bumpPress = useCallback((key) => {
    setPress((prev) => ({ key, nonce: (prev?.nonce ?? 0) + 1 }))
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => setPress(null), PRESS_MS)
  }, [])

  const pressKey = useCallback((char) => {
    const { active, wordLength, keyStates } = latest.current
    if (!active) return
    const c = char.toLowerCase()
    if (!TYPEABLE.test(c)) return

    // Ruled out: every occurrence of this character, in every guess so far,
    // came back grey — which deriveKeyStates only ever concludes when the
    // character genuinely isn't in the word. So refusing it can never block
    // the answer, only a guess that was already certain to be wrong.
    //
    // Refused keys shake instead of popping — one press, one gesture.
    if (keyStates[c] === 'grey') {
      reject(c)
      return
    }

    // The row is full: the press lands nowhere, so don't pop it either.
    if (latest.current.input.length >= wordLength) return

    bumpPress(c)
    setInput((prev) => (prev.length >= wordLength ? prev : prev + c))
  }, [reject, bumpPress])

  const pressBackspace = useCallback(() => {
    if (!latest.current.active) return
    bumpPress('back')
    setInput((prev) => prev.slice(0, -1))
  }, [bumpPress])

  const pressEnter = useCallback(() => {
    const { active, input, wordLength, onSubmit } = latest.current
    if (!active) return
    bumpPress('enter')

    // The length check lives here rather than in each screen's submit: this
    // already knows the word length, and refusing before onSubmit keeps a
    // short guess from costing a server round-trip on the duel path.
    if (input.length !== wordLength) {
      setShortfall((prev) => ({ nonce: (prev?.nonce ?? 0) + 1 }))
      clearTimeout(shortfallTimer.current)
      shortfallTimer.current = setTimeout(() => setShortfall(null), SHORTFALL_MS)
      return
    }

    onSubmit(input)
  }, [bumpPress])

  useEffect(() => {
    function onKeyDown(e) {
      if (!latest.current.active) return
      // Leave browser shortcuts alone — without this Ctrl/Cmd+R types an "r"
      // into the grid on its way to reloading the page.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // Don't type into the grid sitting behind an open How to play modal,
      // or while a real field (the setter's name, a hint) has focus.
      if (document.querySelector('.modal-overlay')) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return

      if (e.key === 'Enter') {
        e.preventDefault()
        pressEnter()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        pressBackspace()
      } else if (e.key.length === 1 && TYPEABLE.test(e.key.toLowerCase())) {
        e.preventDefault()
        pressKey(e.key)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pressKey, pressBackspace, pressEnter])

  useEffect(() => () => {
    clearTimeout(rejectTimer.current)
    clearTimeout(pressTimer.current)
    clearTimeout(shortfallTimer.current)
  }, [])

  return { input, setInput, pressKey, pressBackspace, pressEnter, rejection, press, shortfall }
}
