"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import { brandApi, queryKeys, type Brand } from "@/src/api/api";

const REVEAL = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export function Brands() {
  const { data } = useQuery({
    queryKey: queryKeys.brandsActive,
    queryFn: () => brandApi.listActive(),
  });
  const brands = data ?? [];

  // Nothing to show once the admin has no active brand logos — the section
  // simply doesn't render rather than showing an empty marquee.
  if (brands.length === 0) return null;

  return (
    <section className="overflow-hidden bg-linear-to-b from-white to-gray-50 py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          variants={REVEAL}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-[38px]">
            Our associated brands
          </h2>

          <p className="mt-2 max-w-xl text-sm text-gray-500">
            Trusted by leading restaurants, institutions and hospitality brands.
          </p>
        </motion.div>

        {/* Marquee, same container width as the neighbouring sections: logos
            drift continuously, fade out at both edges and pause on hover. */}
        <motion.div
          variants={REVEAL}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
          className="mt-8 mask-[linear-gradient(to_right,transparent,black_4%,black_96%,transparent)] sm:mt-10"
        >
          <Swiper
            modules={[Autoplay]}
            loop
            speed={5000}
            spaceBetween={16}
            slidesPerView="auto"
            autoplay={{
              delay: 0,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            allowTouchMove={false}
            className="ease-linear! [&_.swiper-wrapper]:ease-linear!"
          >
            {[...brands, ...brands].map((brand, i) => (
              <SwiperSlide key={`${brand.brandId}-${i}`} className="w-auto!">
                <BrandLogo brand={brand} />
              </SwiperSlide>
            ))}
          </Swiper>
        </motion.div>
      </div>
    </section>
  );
}

function BrandLogo({ brand }: { brand: Brand }) {
  return (
    <div className="group flex w-32 flex-col items-center px-1 py-3 sm:w-36">
      <div
        className="relative h-24 w-24 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-xl group-hover:shadow-gray-900/10 group-hover:ring-orange-200 sm:h-28 sm:w-28"
      >
        <Image
          src={brand.imageUrl}
          alt={brand.name}
          fill
          sizes="112px"
          className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <p className="mt-3 line-clamp-2 h-8 w-full text-center text-xs font-medium leading-4 text-gray-500 transition-colors group-hover:text-gray-900">
        {brand.name}
      </p>
    </div>
  );
}
