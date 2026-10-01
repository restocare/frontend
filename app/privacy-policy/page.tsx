"use client";

import { useState } from "react";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { CursorFollower } from "@/src/components/landing/cursor-follower";

interface ContentBlock {
  subtitle?: string;
  body?: string;
  bullets?: string[];
  footer?: string;
}

interface PolicySection {
  id: string;
  title: string;
  content: ContentBlock[];
}

const sections: PolicySection[] = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    content: [
      {
        subtitle: "1.1 Personal Information",
        body: "When you create an account, make a booking, contact support, or use our services, we may collect personal information including:",
        bullets: ["Full name", "Email address", "Phone number"],
      },
      {
        subtitle: "1.2 Location Data",
        body: "We may collect your location information to:",
        bullets: [
          "Assign nearby service partners",
          "Improve booking accuracy",
          "Enhance service efficiency",
          "Provide location-based support",
        ],
        footer:
          "Location data may be collected through GPS, IP address, device settings, or the address entered by you during booking.",
      },
      {
        subtitle: "1.3 Device Information",
        body: "We may collect certain technical information about the device you use to access our Platform, including:",
        bullets: [
          "Device ID",
          "Device type",
          "Operating system version",
          "App version",
          "Browser type",
          "Network information",
        ],
      },
      {
        subtitle: "1.4 Usage Data",
        body: "We may collect information about how you interact with the Platform, including:",
        bullets: [
          "App activity",
          "Booking history",
          "Search and browsing activity",
          "Pages or screens viewed",
          "Time spent on the app",
          "Support requests and communication history",
        ],
      },
    ],
  },
  {
    id: "how-we-use",
    title: "2. How We Use Your Information",
    content: [
      {
        body: "We use the information we collect for legitimate business and operational purposes, including to:",
        bullets: [
          "Create and manage user accounts",
          "Process and manage bookings",
          "Connect users with suitable service providers",
          "Provide customer support and respond to queries",
          "Send service-related updates, alerts, and communication",
          "Improve app functionality, performance, and user experience",
          "Detect fraud, abuse, or unauthorized activity",
          "Comply with legal, tax, regulatory, and compliance requirements",
        ],
      },
    ],
  },
  {
    id: "data-sharing",
    title: "3. Data Sharing and Disclosure",
    content: [
      {
        body: "We do not sell your personal information. However, we may share your information in the following situations:",
      },
      {
        subtitle: "3.1 With Service Partners",
        body: "We may share relevant booking and contact details with service partners, technicians, drivers, or other service personnel for the purpose of fulfilling your booking and providing services efficiently.",
      },
      {
        subtitle: "3.2 With Payment Service Providers",
        body: "We may share limited payment-related information with trusted payment gateways and processors such as Razorpay or similar providers to securely process payments.",
      },
      {
        subtitle: "3.3 With Technology and Service Providers",
        body: "We may share data with third-party service providers that help us operate our Platform, including cloud hosting, analytics, communication tools, and customer support systems.",
      },
      {
        subtitle: "3.4 Legal Requirements",
        body: "We may disclose your information where required by law, court order, governmental authority, law enforcement, regulatory requirement, or where such disclosure is necessary to protect our legal rights, users, systems, or business interests.",
      },
    ],
  },
  {
    id: "data-security",
    title: "4. Data Security",
    content: [
      {
        body: "We take reasonable technical, administrative, and organizational measures to protect your information from unauthorized access, misuse, alteration, disclosure, or destruction. These measures include:",
        bullets: [
          "Encrypted transmission of data using HTTPS",
          "Use of secure servers and protected systems",
          "Restricted internal access controls",
          "Monitoring and security practices designed to protect stored data",
        ],
        footer:
          "While we take commercially reasonable efforts to secure your data, no digital platform or online transmission can be guaranteed to be completely secure.",
      },
    ],
  },
  {
    id: "user-rights",
    title: "5. User Rights and Choices",
    content: [
      {
        body: "Subject to applicable law, you may have the right to:",
        bullets: [
          "Access your account data",
          "Update or correct your profile information",
          "Request deletion of your account",
          "Contact us regarding your personal data",
          "Delete your account by using the site",
        ],
        footer:
          "Please note that deletion requests may be subject to verification and certain legal or operational limitations.",
      },
    ],
  },
  {
    id: "data-retention",
    title: "6. Data Retention",
    content: [
      {
        body: "We retain your personal information only for as long as necessary for the purposes described in this Policy, including service delivery, account maintenance, compliance, and dispute resolution.",
      },
      {
        body: "Upon account deletion, we will delete or anonymize your personal data within a reasonable period, except where certain information must be retained for:",
        bullets: [
          "Legal obligations",
          "Tax and accounting requirements",
          "Fraud prevention",
          "Dispute resolution",
          "Enforcement of our rights and policies",
        ],
      },
    ],
  },
  {
    id: "third-party",
    title: "7. Third-Party Services",
    content: [
      {
        body: "Our Platform may integrate with or rely on third-party services for certain functions. These may include:",
        bullets: [
          "Razorpay for payment processing",
          "Firebase for app infrastructure, notifications, analytics, or authentication",
          "Google services for maps, login, analytics, or related functionality",
        ],
        footer:
          "These third-party services may collect, process, or store your data in accordance with their own privacy policies. We encourage users to review the privacy policies of such third parties separately.",
      },
    ],
  },
  {
    id: "childrens-privacy",
    title: "8. Children's Privacy",
    content: [
      {
        body: "The Platform is not intended for children under the age of 13 years. We do not knowingly collect personal information from children under 13. If we become aware that such information has been collected, we may take appropriate steps to delete it.",
      },
    ],
  },
  {
    id: "changes",
    title: "9. Changes to This Privacy Policy",
    content: [
      {
        body: "Restocare reserves the right to update, modify, or revise this Privacy Policy at any time. Any changes will become effective upon posting the updated Policy on the Platform, unless otherwise required by law.",
      },
      {
        body: "You are encouraged to review this Privacy Policy periodically to remain informed about how we collect, use, and protect your information.",
      },
    ],
  },
  {
    id: "contact",
    title: "10. Contact Us",
    content: [
      {
        body: "If you have any questions, concerns, complaints, or requests relating to this Privacy Policy or your personal data, you may contact us at:",
      },
    ],
  },
];

export default function PrivacyPolicyPage() {
  const [search, setSearch] = useState("");

  return (
    <div data-theme="light" className="min-h-dvh bg-gray-50">
      <CursorFollower />
      <LandingHeader search={search} onSearchChange={setSearch} />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
        {/* Hero */}
        <div className="mb-12 rounded-3xl bg-gradient-to-br from-[#0A192F] to-[#1a3a5c] px-8 py-12 text-white shadow-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 ring-1 ring-white/20">
            🔒 Legal
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-base text-white/70">
            Last Updated: 20 March 2026
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80">
            This Privacy Policy explains how Restocare collects, uses, stores,
            shares, and protects your information when you access, use, register
            on, or make bookings through the Restocare mobile application,
            website, or related services (collectively, the &ldquo;Platform&rdquo;).
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">
            Restocare is a service-booking platform designed for restaurants and
            food businesses to book professional service support, including
            chefs, technicians, utility staff, kitchen support, cleaning
            services, and other related service partners.
          </p>
          <p className="mt-3 text-sm text-white/70">
            By using the Platform, you agree to the collection and use of your
            information in accordance with this Privacy Policy. If you do not
            agree with this Policy, please do not use the Platform.
          </p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">
            Table of Contents
          </h2>
          <ol className="space-y-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-sm text-[#0A192F] underline-offset-2 transition hover:underline"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <h2 className="mb-5 text-lg font-bold text-[#1f4e79] sm:text-xl">
                {section.title}
              </h2>
              <div className="space-y-5">
                {section.content.map((block, bi) => (
                  <div key={bi}>
                    {block.subtitle && (
                      <h3 className="mb-2 font-semibold text-gray-800">
                        {block.subtitle}
                      </h3>
                    )}
                    {block.body && (
                      <p className="text-sm leading-relaxed text-gray-600">
                        {block.body}
                      </p>
                    )}
                    {(block.bullets?.length ?? 0) > 0 && (
                      <ul className="mt-2 space-y-1">
                        {block.bullets!.map((b, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-gray-600"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e2563b]" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                    {block.footer && (
                      <p className="mt-3 text-sm leading-relaxed text-gray-500 italic">
                        {block.footer}
                      </p>
                    )}
                  </div>
                ))}

                {/* Contact section special content */}
                {section.id === "contact" && (
                  <div className="mt-2 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold">Email:</span>{" "}
                      <a
                        href="mailto:support@restocare.in"
                        className="text-[#e2563b] hover:underline"
                      >
                        support@restocare.in
                      </a>
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">Phone:</span>{" "}
                      <a
                        href="tel:+919953532995"
                        className="text-[#e2563b] hover:underline"
                      >
                        +91 99535 32995
                      </a>
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">Address:</span> 180 KD,
                      Pitampura, Opposite Pillar No. 342, Kohat Enclave, Delhi
                      110034
                    </p>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-10 rounded-2xl border border-orange-100 bg-orange-50 p-6 text-center text-sm text-orange-700">
          <p>
            Restocare is a brand operated by{" "}
            <span className="font-semibold">Restroedge Private Limited</span>.
            &copy; {new Date().getFullYear()} All rights reserved.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
