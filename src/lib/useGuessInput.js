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

export function useGuessInput({ wordLength, active, onSubmit }) {
  const [input, setInput] = useState('')

  // The window listener below is bound once per handler identity, not per
  // keystroke, so it reads everything changeable through this ref rather
  // than closing over a render's values and going stale.
  const latest = useRef(null)
  latest.current = { input, wordLength, active, onSubmit }

  const pressKey = useCallback((char) => {
    const { active, wordLength } = latest.current
    if (!active) return
    const c = char.toLowerCase()
    if (!TYPEABLE.test(c)) return
    setInput((prev) => (prev.length >= wordLength ? prev : prev + c))
  }, [])

  const pressBackspace = useCallback(() => {
    if (!latest.current.active) return
    setInput((prev) => prev.slice(0, -1))
  }, [])

  const pressEnter = useCallback(() => {
    const { active, input, onSubmit } = latest.current
    if (!active) return
    onSubmit(input)
  }, [])

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

  return { input, setInput, pressKey, pressBackspace, pressEnter }
}
