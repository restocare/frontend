export function PartnerCTA() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-[#070b16] px-6 py-12 shadow-2xl sm:px-10 sm:py-16">
        {/* Base gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1326] via-[#0a1020] to-[#070b16]" />

        {/* Glowing top arc */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[1200px] max-w-[150%] -translate-x-1/2 -translate-y-[86%] rounded-[50%] border border-blue-400/30 [box-shadow:0_40px_140px_rgba(59,130,246,0.25)]" />

        {/* Perspective grid floor */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-40 [background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:44px_44px] [transform:perspective(320px)_rotateX(62deg)] [transform-origin:bottom]" />

        {/* Ambient center glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />

        {/* Content */}
        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="text-xl font-bold sm:pt-4 tracking-tight text-white sm:text-[44px] sm:leading-[1.1]">
            Become a service partner
          </h2>
          <p className="mt-4 max-w-xl text-sm text-gray-400 sm:text-base">
            Grow your business by listing your services and receiving quality bookings daily.
          </p>
          <button className="group mt-8 inline-flex items-center gap-2 rounded-full bg-orange-500 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-orange-400 [box-shadow:0_0_45px_rgba(249,115,22,0.55)]">
            Get Started
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
          <p className="mt-5 text-xs text-gray-500">
            Free to join. No hidden fees. Start receiving bookings today.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Testimonials() {
  const reviews = [
    {
      id: 1,
      title: '"Excellent Experience"',
      content: "Booking was smooth and the professional arrived on time. Highly recommended for busy families.",
      name: "Priya Sharma",
      role: "Restaurant Owner",
      color: "from-orange-500 to-amber-500",
    },
    {
      id: 2,
      title: '"Very Convenient"',
      content: "I found and booked an electrician in under five minutes. The app flow is fast and very clear.",
      name: "Rahul Verma",
      role: "Cafe Manager",
      color: "from-blue-500 to-indigo-500",
    },
    {
      id: 3,
      title: '"Best Service Quality"',
      content: "The quality of work was top-notch and support team was quick to respond throughout the process.",
      name: "Anita Desai",
      role: "Cloud Kitchen",
      color: "from-emerald-500 to-teal-500",
    },
    {
      id: 4,
      title: '"Will Book Again"',
      content: "Transparent pricing, clean UI, and reliable providers. I already booked my second service.",
      name: "Vikram Singh",
      role: "Hotel F&B Head",
      color: "from-rose-500 to-pink-500",
    },
  ];

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <section className="bg-white pb-12 pt-2">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10">
          <h2 className="text-xl font-bold tracking-tight text-[#0A192F] sm:text-[38px]">
            What our customers say
          </h2>
          <p className="mt-2 text-sm text-gray-500 sm:text-base">
            Real feedback from users who book services daily on our platform.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              {/* 5-star rating */}
              <div className="mb-3 flex gap-0.5 text-amber-400" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>

              <h3 className="mb-2 text-base font-bold text-gray-900">
                {review.title}
              </h3>
              <p className="flex-1 text-sm leading-relaxed text-gray-500">
                {review.content}
              </p>

              {/* Author — initials monogram instead of a photo */}
              <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br ${review.color} text-sm font-bold text-white`}
                >
                  {initials(review.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {review.name}
                  </p>
                  <p className="truncate text-xs text-gray-400">{review.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
