"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MailIcon, MapPinIcon, PhoneIcon } from "@/src/components/icons";

function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  // Official WhatsApp glyph (Font Awesome brands path).
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 448 512"
      fill="currentColor"
      {...props}
    >
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" {...props}>
      <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" fill="currentColor" {...props}>
      <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z" />
    </svg>
  );
}

function LinkedInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" {...props}>
      <path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z" />
    </svg>
  );
}

function YouTubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor" {...props}>
      <path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z" />
    </svg>
  );
}

/** Simplified official UPI mark: green + orange forward chevrons. */
function UpiMarkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <path d="M8.6 3.5 14 12l-5.4 8.5-1.9-1.2L11.3 12 6.7 4.7l1.9-1.2z" fill="#16a34a" />
      <path d="M13.6 3.5 19 12l-5.4 8.5-1.9-1.2L16.3 12l-4.6-7.3 1.9-1.2z" fill="#f59e0b" />
    </svg>
  );
}

function CardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  );
}

function BankIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7" />
      <path d="M3 20h18" />
    </svg>
  );
}

function GooglePlayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" {...props}>
      <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
    </svg>
  );
}

function AppStoreIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" {...props}>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function ArrowUpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l7.5-7.5 7.5 7.5m-15 6l7.5-7.5 7.5 7.5" />
    </svg>
  );
}

export function Footer() {
  const [showTopBtn, setShowTopBtn] = useState(false);

  useEffect(() => {
    // Only after the visitor has scrolled past the first screen.
    const handleScroll = () => {
      setShowTopBtn(window.scrollY > window.innerHeight);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative bg-[#0F1115] pt-12 pb-8 text-sm text-gray-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Quick Links */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-white">Quick Links</h3>
            <ul className="space-y-3">
              <li><Link href="/refund-cancellation-policy" className="hover:text-white transition">Refund &amp; Cancellation Policy</Link></li>
              <li><Link href="/terms-and-conditions" className="hover:text-white transition">Terms And Conditions</Link></li>
              <li><Link href="/products" className="hover:text-white transition">Products</Link></li>
              <li><Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
              <li><Link href="/careers" className="hover:text-white transition">Careers</Link></li>
              <li><Link href="/contact" className="hover:text-white transition">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact Us */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-white">
              <Link href="/contact" className="hover:text-yellow-500 transition">Contact Us</Link>
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                <span>KD-180 Kohat Enclave, Pitampura, Delhi - 110034</span>
              </li>
              <li className="flex items-center gap-3">
                <PhoneIcon className="h-4 w-4 shrink-0 text-yellow-500" />
                <a href="tel:+919953532995" className="hover:text-white transition">
                  +91 99535 32995
                </a>
              </li>
              <li className="flex items-center gap-3">
                <MailIcon className="h-4 w-4 shrink-0 text-yellow-500" />
                <a href="mailto:support@restocare.in" className="hover:text-white transition">
                  support@restocare.in
                </a>
              </li>
            </ul>
          </div>

          {/* Payment Methods & Socials */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-white">Payment Methods</h3>
            <div className="flex flex-wrap gap-2 mb-8">
              <span className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200">
                <UpiMarkIcon className="h-4 w-4" />
                UPI
              </span>
              <span className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200">
                <CardIcon className="h-4 w-4 text-sky-400" />
                All Cards
              </span>
              <span className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200">
                <BankIcon className="h-4 w-4 text-amber-400" />
                Net Banking
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-bold text-white">Keep In Touch</span>
              <div className="flex gap-4 text-yellow-500">
                <a
                  href="https://www.instagram.com/restocare_/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="RestoCare on Instagram"
                  className="hover:text-white transition"
                >
                  <InstagramIcon className="h-5 w-5" />
                </a>
                <a
                  href="https://www.facebook.com/profile.php?id=61584401909814"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="RestoCare on Facebook"
                  className="hover:text-white transition"
                >
                  <FacebookIcon className="h-5 w-5" />
                </a>
                <a
                  href="https://www.linkedin.com/company/resto-care1111/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="RestoCare on LinkedIn"
                  className="hover:text-white transition"
                >
                  <LinkedInIcon className="h-5 w-5" />
                </a>
                <a
                  href="https://www.youtube.com/@restocare.1"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="RestoCare on YouTube"
                  className="hover:text-white transition"
                >
                  <YouTubeIcon className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Find Our App */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-white">Find Our App On Mobile</h3>
            <div className="flex flex-col items-start gap-3">
              <a
                href="https://apps.apple.com/in/app/restocare-stop-revenue-loss/id6787001148"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-44 items-center gap-2.5 rounded-xl border border-gray-700 bg-black px-4 py-2 transition hover:bg-gray-800"
              >
                <AppStoreIcon className="h-6 w-6 shrink-0 text-white" />
                <span className="text-left leading-tight">
                  <span className="block text-[10px] uppercase tracking-wide text-gray-400">
                    Download on the
                  </span>
                  <span className="block text-sm font-bold text-white">App Store</span>
                </span>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.restocare.customer&pcampaignid=web_share"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-44 items-center gap-2.5 rounded-xl border border-gray-700 bg-black px-4 py-2 transition hover:bg-gray-800"
              >
                <GooglePlayIcon className="h-6 w-6 shrink-0 text-white" />
                <span className="text-left leading-tight">
                  <span className="block text-[10px] uppercase tracking-wide text-gray-400">
                    Get it on
                  </span>
                  <span className="block text-sm font-bold text-white">Google Play</span>
                </span>
              </a>
            </div>
          </div>

        </div>

        <div className="mt-10 border-t border-gray-800 pt-6 text-center">
          <p>
            © 2025 Restocare, a brand operated by Restroedge Private Limited.
            All rights reserved.
          </p>
        </div>
      </div>

      {/* Floating WhatsApp Button — the one contact button */}
      <a
        href="https://wa.me/919953532995"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition-transform hover:scale-110"
        aria-label="Contact us on WhatsApp"
      >
        <WhatsAppIcon className="h-8 w-8" />
      </a>

      {/* Floating Scroll to Top Button (appears after one screen of scroll) */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-24 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFD13B] text-white shadow-xl transition-all duration-300 hover:bg-[#FFC107] ${
          showTopBtn ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"
        }`}
        aria-label="Scroll to top"
      >
        <ArrowUpIcon className="h-6 w-6" />
      </button>
    </footer>
  );
}
