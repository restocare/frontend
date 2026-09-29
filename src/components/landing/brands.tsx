"use client";

import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";

interface Brand {
  name: string;
  logo: string;
}

// Only the logos that actually exist in /public/brands.
const BRANDS: Brand[] = [
  { name: "Brand", logo: "/brands/brand1.png" },
  { name: "Brand", logo: "/brands/brand2.png" },
  { name: "Brand", logo: "/brands/brand3.png" },
  { name: "Brand", logo: "/brands/brand5.jpeg" },
  { name: "Tourism & Hospitality Skill Council", logo: "/brands/thsc.png" },
];

export function Brands() {
  return (
    <section className="bg-linear-to-b from-white to-gray-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-[38px]">
          Our associated brands
        </h2>

        <p className="mt-2 max-w-xl text-sm text-gray-500">
          Trusted by leading restaurants, institutions and hospitality brands.
        </p>

        <div className="mt-10">
          <Swiper
            modules={[Autoplay]}
            loop
            speed={4000}
            spaceBetween={24}
            slidesPerView={2}
            autoplay={{
              delay: 0,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            allowTouchMove={false}
            breakpoints={{
              640: { slidesPerView: 3 },
              1024: { slidesPerView: 5 },
              1280: { slidesPerView: 6 },
            }}
            className="!ease-linear [&_.swiper-wrapper]:!ease-linear"
          >
            {[...BRANDS, ...BRANDS].map((brand, i) => (
              <SwiperSlide key={`${brand.logo}-${i}`} className="flex! items-center justify-center">
                <BrandLogo brand={brand} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </section>
  );
}

function BrandLogo({ brand }: { brand: Brand }) {
  return (
    <div className="group flex items-center justify-center py-2">
      <div className="flex h-24 w-32 items-center justify-center rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
        <Image
          src={brand.logo}
          alt={brand.name}
          width={96}
          height={64}
          className="max-h-full w-auto object-contain"
        />
      </div>
    </div>
  );
}