"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Entrance for the /account section (login, account, orders). Templates
 * remount when the segment is entered, so the page rises in from the bottom
 * instead of swapping in abruptly when the header account button is clicked.
 */
export default function AccountTemplate({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
