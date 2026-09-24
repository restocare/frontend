"use client";

import { useEffect, useState } from "react";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Reveal } from "@/src/components/landing/reveal";
import { CursorFollower } from "@/src/components/landing/cursor-follower";
import { Hero } from "@/src/components/landing/hero";
import { PhoneShowcase } from "@/src/components/landing/phone-showcase";
import { StatsBand } from "@/src/components/landing/stats-band";
import { Brands } from "@/src/components/landing/brands";
import { PopularCategories } from "@/src/components/landing/popular-categories";
import { HowItWorks } from "@/src/components/landing/how-it-works";
import { ServiceGrid } from "@/src/components/landing/service-grid";
import { WhyChooseUs } from "@/src/components/landing/why-choose-us";
import { TopProviders } from "@/src/components/landing/top-providers";
import { RestaurantRepair } from "@/src/components/landing/restaurant-repair";
import { VideoBanner } from "@/src/components/landing/video-banner";
import { PartnerCTA, Testimonials } from "@/src/components/landing/testimonials";
import { FAQs } from "@/src/components/landing/faqs";
import { Footer } from "@/src/components/landing/footer";

export function HomeContent() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  return (
    <div data-theme="light" className="min-h-dvh bg-white">
      <CursorFollower />
      <LandingHeader search={search} onSearchChange={setSearch} />
      <main>
        <Hero />

        <Reveal>
          <PopularCategories selectedCategoryId={categoryId} onSelect={setCategoryId} />
        </Reveal>
        <PhoneShowcase />
        <VideoBanner />
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Reveal>
          <ServiceGrid search={debouncedSearch} categoryId={categoryId} />
        </Reveal>
        <Reveal>
          <WhyChooseUs />
        </Reveal>
        <Reveal>
          <StatsBand />
        </Reveal>
        <Reveal>
          <TopProviders />
        </Reveal>
        <Reveal>
          <Brands />
        </Reveal>
        <Reveal>
          <RestaurantRepair />
        </Reveal>

        <Reveal>
          <PartnerCTA />
        </Reveal>
        <Reveal>
          <Testimonials />
        </Reveal>
        <Reveal>
          <FAQs />
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}
