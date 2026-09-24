"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Chatbot } from "./chatbot";

function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 001.333 4.993L2 22l5.233-1.337a9.983 9.983 0 004.779 1.216h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.669-1.037-5.176-2.922-7.062A9.935 9.935 0 0012.012 2zm.004 16.634c-1.614 0-3.193-.433-4.576-1.254l-.328-.194-3.398.868.887-3.321-.213-.34A8.28 8.28 0 013.69 8.718c0-4.582 3.731-8.314 8.324-8.314 2.233 0 4.33.869 5.908 2.448a8.312 8.312 0 012.441 5.867c-.001 4.583-3.733 8.315-8.347 8.315zm4.577-6.248c-.251-.126-1.486-.734-1.716-.818-.23-.084-.398-.126-.566.126-.168.251-.649.818-.796.985-.146.168-.293.189-.544.063-.251-.126-1.06-.391-2.02-1.246-.747-.665-1.251-1.488-1.398-1.739-.146-.251-.016-.388.11-.513.113-.113.251-.293.377-.44.126-.146.168-.251.251-.418.084-.168.042-.314-.021-.44-.063-.126-.566-1.362-.776-1.865-.205-.491-.413-.424-.566-.432h-.482c-.168 0-.44.063-.67.314-.23.251-.88 .859-.88 2.094s.9 2.428 1.026 2.596c.126.168 1.77 2.701 4.288 3.788 2.518 1.087 2.518.724 2.978.682.46-.042 1.486-.607 1.696-1.194.21-.586.21-1.088.146-1.194-.063-.105-.23-.168-.481-.294z" />
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
    const handleScroll = () => {
      setShowTopBtn(window.scrollY > 400);
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
              <li><Link href="#" className="hover:text-white transition">Become Our Partner</Link></li>
              <li><Link href="#" className="hover:text-white transition">Refund & Cancellation Policy</Link></li>
              <li><Link href="#" className="hover:text-white transition">Terms And Conditions</Link></li>
              <li><Link href="/products" className="hover:text-white transition">Products</Link></li>
              <li><Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
              <li><Link href="/careers" className="hover:text-white transition">Careers</Link></li>
              <li><Link href="/contact" className="hover:text-white transition">Contact Us</Link></li>
              <li><Link href="#" className="hover:text-white transition">Freelancer Registration</Link></li>
            </ul>
          </div>

          {/* Contact Us */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-white">
              <Link href="/contact" className="hover:text-yellow-500 transition">Contact Us</Link>
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="mt-1">📍</span>
                <span>KD-180 Kohat Enclave, Pitampura, Delhi</span>
              </li>
              <li className="flex items-center gap-3">
                <span>📞</span>
                <span>+91 98993 00646</span>
              </li>
              <li className="flex items-center gap-3">
                <span>✉️</span>
                <span>support@restocare.in</span>
              </li>
            </ul>
          </div>

          {/* Payment Methods & Socials */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-white">Payment Methods</h3>
            <div className="flex flex-wrap gap-2 mb-8">
              {/* Dummy payment icons */}
              <div className="h-8 w-12 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">VISA</div>
              <div className="h-8 w-12 rounded bg-white flex items-center justify-center text-orange-500 text-[9px] font-bold">DISCOVER</div>
              <div className="h-8 w-12 rounded bg-blue-400 flex items-center justify-center text-white text-[9px] font-bold text-center leading-tight">AMERICAN<br/>EXPRESS</div>
              <div className="h-8 w-12 rounded bg-gray-800 flex items-center justify-center text-white text-[10px] font-bold">
                <div className="flex"><div className="w-4 h-4 rounded-full bg-red-500 opacity-80 -mr-1"></div><div className="w-4 h-4 rounded-full bg-yellow-500 opacity-80"></div></div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-bold text-white">Keep In Touch</span>
              <div className="flex gap-3 text-yellow-500">
                <Link href="#" className="hover:text-white transition"><span className="text-xl">📷</span></Link>
                <Link href="#" className="hover:text-white transition"><span className="text-xl">📘</span></Link>
                <Link href="#" className="hover:text-white transition"><span className="text-xl">🔗</span></Link>
                <Link href="#" className="hover:text-white transition"><span className="text-xl">🐦</span></Link>
              </div>
            </div>
          </div>

          {/* Find Our App */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-white">Find Our App On Mobile</h3>
            <div className="flex gap-4">
              <div className="space-y-2">
                <div className="h-20 w-20 bg-white p-1 rounded-sm flex items-center justify-center">
                  <div className="w-full h-full bg-[url('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fapps.apple.com%2Fin%2Fapp%2Frestocare-stop-revenue-loss%2Fid6787001148')] bg-cover"></div>
                </div>
                <a
                  href="https://apps.apple.com/in/app/restocare-stop-revenue-loss/id6787001148"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md bg-black px-2 py-1.5 border border-gray-700 hover:bg-gray-800 w-full justify-center text-white"
                >
                  <span className="text-xs">App Store</span>
                </a>
              </div>
              <div className="space-y-2">
                <div className="h-20 w-20 bg-white p-1 rounded-sm flex items-center justify-center">
                  <div className="w-full h-full bg-[url('https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.restocare.customer')] bg-cover"></div>
                </div>
                <a
                  href="https://play.google.com/store/apps/details?id=com.restocare.customer&pcampaignid=web_share"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md bg-black px-2 py-1.5 border border-gray-700 hover:bg-gray-800 w-full justify-center text-white"
                >
                  <span className="text-xs">Google Play</span>
                </a>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-10 border-t border-gray-800 pt-6 text-center">
          <p>Restocare is a brand operated by Restroedge Private Limited.</p>
        </div>
      </div>

      {/* Support chatbot (floating, bottom-right) */}
      <Chatbot />

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/919899300646"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition-transform hover:scale-110"
        aria-label="Contact us on WhatsApp"
      >
        <WhatsAppIcon className="h-8 w-8" />
      </a>

      {/* Floating Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-24 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFD13B] text-white shadow-xl transition-all duration-300 hover:bg-[#FFC107] ${
          showTopBtn ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"
        }`}
        aria-label="Scroll to top"
      >
        <ArrowUpIcon className="h-6 w-6" />
      </button>
    </footer>
  );
}
