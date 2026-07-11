"use client"

import { useEffect, useRef, useState } from "react"

/**
 * fades + slides children in once they enter the viewport. fires almost
 * immediately for anything already in view on load (the hero), and on
 * scroll for everything below the fold - same primitive, one effect.
 */
export default function Reveal({
  children,
  className = "",
  delay = 0
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [skipAnimation, setSkipAnimation] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSkipAnimation(true)
      setVisible(true)
      return
    }

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`${className} ${
        skipAnimation
          ? ""
          : `transition-all duration-700 ease-out ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`
      }`}
      style={skipAnimation ? undefined : { transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
