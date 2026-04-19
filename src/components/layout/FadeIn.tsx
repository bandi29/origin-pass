"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"

type FadeInProps = {
  children: ReactNode
  className?: string
}

export function FadeIn({ children, className }: FadeInProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
