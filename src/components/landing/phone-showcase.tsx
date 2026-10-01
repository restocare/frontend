"use client";

import { motion } from "framer-motion";
import { PhoneScreens } from "./phone-screens";

/**
 * "See it in action" section. The phone is a pure CSS mockup: the live UI
 * (PhoneScreens) renders at its natural 290×600px inside a rounded frame, so
 * text stays pixel-crisp and the screen can never poke out of the body —
 * both of which the old 3D (three.js) phone kept getting wrong.
 */
export function PhoneShowcase() {
  return (
    <section className="relative overflow-hidden border-b border-gray-100 bg-linear-to-b from-gray-50 via-white to-white">
      {/* soft accent glows */}
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-orange-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />

      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-14">
        {/* Copy */}
        <div className="text-center lg:order-2 lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            See it in action
          </span>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-gray-900 sm:text-[38px]">
            From booking to your doorstep — in real time
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base text-gray-600 lg:mx-0">
            Customers book a service in a few taps. The moment they confirm, the
            nearest verified partner gets the lead allocated on the map and heads
            your way — all tracked live.
          </p>

          <div className="mt-6 grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
            <FlowStep step="1" title="Customer books" desc="Pick a service & slot" />
            <FlowStep step="2" title="Lead allocated" desc="Nearest partner notified" />
            <FlowStep step="3" title="Partner accepts" desc="Routed via live map" />
            <FlowStep step="4" title="On the way" desc="Real-time tracking" />
          </div>
        </div>

        {/* CSS phone mockup */}
        <div className="flex w-full items-center justify-center py-6 lg:order-1">
          <div className="animate-float-slow relative rounded-[42px] bg-gray-950 p-2.5 shadow-2xl ring-1 ring-black/10">
            {/* Side buttons */}
            <span
              className="absolute -right-1 top-28 h-16 w-1 rounded-full bg-gray-800"
              aria-hidden
            />
            <span
              className="absolute -left-1 top-24 h-10 w-1 rounded-full bg-gray-800"
              aria-hidden
            />
            {/* Screen — natural size, never scaled, never clipped */}
            <div className="overflow-hidden rounded-[34px]">
              <PhoneScreens />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowStep({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={{ rest: { y: 0 }, hover: { y: -4 } }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm transition-shadow duration-200 hover:shadow-md"
    >
      <motion.span
        variants={{
          rest: { scale: 1, rotate: 0 },
          hover: { scale: 1.15, rotate: [0, -8, 8, -4, 0] },
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-xs font-bold text-white"
      >
        {step}
      </motion.span>
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </motion.div>
  );
}
