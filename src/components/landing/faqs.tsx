"use client";

import { useState } from "react";
import Image from "next/image";

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

const faqs = [
  {
    num: "01",
    question: "What is RestoCare?",
    answer:
      "RestoCare is an on-demand service marketplace where you can discover verified professionals, compare options, and book services in just a few clicks.",
  },
  {
    num: "02",
    question: "How do I book a service?",
    answer:
      "Search your required service, choose a provider based on ratings and pricing, select your preferred date and time, then confirm your booking securely.",
  },
  {
    num: "03",
    question: "Are your professionals verified?",
    answer:
      "Yes — every professional is background-checked and certified before they take a booking.",
  },
  {
    num: "04",
    question: "Can I track my booking in real time?",
    answer:
      "Yes, you can monitor booking status, provider assignment, and service progress from your account dashboard in real time.",
  },
  {
    num: "05",
    question: "How do I get an invoice?",
    answer:
      "Open My Bookings in your account, find the booking and tap “Download Invoice”. You can print it or save it as a PDF.",
  },
  {
    num: "06",
    question: "How can I register as a service provider?",
    answer:
      "Click on \"Become a service partner\", complete the onboarding form, submit required documents, and our team will review and activate your profile.",
  },
  {
    num: "07",
    question: "Is my payment information secure?",
    answer:
      "Absolutely. We use secure encrypted payment gateways and never store sensitive card details on our application servers.",
  },
];

export function FAQs() {
  const [openIndex, setOpenIndex] = useState<number | null>(1); // Index 1 (02) is open by default

  return (
    <section className="bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8">
          <h2 className="text-xl font-bold tracking-tight text-[#0A192F] sm:text-[38px]">
            Frequently asked <span className="text-orange-600">questions</span>
          </h2>
          <p className="mt-4 text-sm text-gray-500 sm:text-base">
            Everything you need to know about RestoCare - bookings, providers, and payments.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left Image Banner */}
          <div className="relative flex min-h-[300px] w-full flex-col justify-end overflow-hidden rounded-2xl bg-gray-900 shadow-md lg:h-auto lg:min-h-[400px]">
            <Image
              src="https://images.unsplash.com/photo-1521791136064-7986c2920216?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dHJ1c3R8ZW58MHx8MHx8fDA%3D"
              alt="Help team"
              fill
              className="object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F]/90 to-transparent"></div>
            <div className="relative z-10 p-8 text-center sm:p-12">
              <h3 className="mb-2 text-xl font-bold text-white sm:text-3xl">Need help fast?</h3>
              <p className="text-sm font-medium text-gray-300 sm:text-base">
                Our team usually replies within a few minutes.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="https://wa.me/919953532995"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700"
                >
                  Chat on WhatsApp
                </a>
                <a
                  href="/contact"
                  className="inline-flex items-center rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Contact us
                </a>
              </div>
            </div>
          </div>

          {/* Right Accordion */}
          <div className="flex flex-col gap-4">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div
                  key={faq.num}
                  className={`rounded-xl border ${
                    isOpen ? "border-gray-100 bg-white shadow-sm" : "border-gray-50 bg-white"
                  } transition-all duration-200`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between p-5 text-left focus:outline-none"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-xs font-bold text-orange-600">
                        {faq.num}
                      </span>
                      <span
                        className={`font-bold transition-colors sm:text-lg ${
                          isOpen ? "text-[#0A192F]" : "text-gray-800"
                        }`}
                      >
                        {faq.question}
                      </span>
                    </div>
                    <span
                      className={`ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all duration-200 ${
                        isOpen ? "bg-orange-50 text-orange-600" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <ChevronDownIcon
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5">
                      <div className="pl-12">
                        <p className="text-sm leading-relaxed text-gray-500 sm:text-[15px]">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
