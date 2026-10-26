"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded project images come from arbitrary hosts; next/image needs each host in remotePatterns. */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  MapPin,
  Compass,
  Layers,
  LandPlot,
  CalendarClock,
  CalendarCheck2,
  Phone,
  Mail,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  FileText,
  CheckCircle2,
  Dumbbell,
  Car,
  Shield,
  Waves,
  TreePine,
  Zap,
  Wifi,
  Droplets,
  Baby,
  Flame,
  Eye,
  Share2,
  Images,
  type LucideIcon,
} from "lucide-react";
import { projectApi } from "@/app/api/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectPreview {
  id: string;
  projectName: string;
  slug: string;
  description?: string;
  address?: string;
  landmark?: string;
  city?: string;
  builderName?: string;
  status: string;
  projectStatus?: string;
  possessionDate?: string;
  facings?: string[];
  projectSubType?: string;
  projectLandArea?: number;
  projectLandUnit?: string;
  startDate?: string;
  endDate?: string;
  basicAmenities?: string[];
  featuredAmenities?: string[];
  isFeatured?: boolean;
  videoLinks?: string[];
  imageUrls?: string[];
  brochureUrl?: string;
  documents?: Array<{ id: string; name: string; url: string; fileName: string }>;
  circleRate?: number;
  properties?: Array<{
    id: string;
    propertyCode?: string;
    block?: string;
    plotSize?: number;
    facing?: string;
    roadWidthFt?: number;
    landUse?: string;
    isCornerPlot?: boolean;
    isParkFacing?: boolean;
    price?: number;
    property_type?: string;
    status?: string;
  }>;
  tenant?: {
    id: string;
    companyName?: string;
    phone?: string;
    email?: string;
  };
}

// ─── Amenity icons map ────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<string, LucideIcon> = {
  "Swimming Pool": Waves,
  "Gym / Fitness Centre": Dumbbell,
  "Club House": Building2,
  "Garden / Landscaping": TreePine,
  "Car Parking": Car,
  Security: Shield,
  CCTV: Eye,
  "24x7 Water Supply": Droplets,
  "Power Back Up": Zap,
  Internet: Wifi,
  "Kids Play Area": Baby,
  "Fire Fighting System": Flame,
};

function getAmenityIcon(name: string): LucideIcon {
  return AMENITY_ICONS[name] || CheckCircle2;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMonth(dateStr?: string) {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length < 2) return dateStr;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${months[monthIdx] ?? parts[1]} ${parts[0]}`;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
  return match ? match[1] : null;
}

function statusClass(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "available" || s === "sold" || s === "reserved") return s;
  return "available";
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, visible] as const;
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, visible] = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "reveal-in" : ""} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

// ─── Corner brackets (signature element) ───────────────────────────────────────

function Brackets({ inset = 10 }: { inset?: number }) {
  return (
    <div className="brackets" aria-hidden="true">
      <span className="bracket bracket-tl" style={{ top: inset, left: inset }} />
      <span className="bracket bracket-tr" style={{ top: inset, right: inset }} />
      <span className="bracket bracket-bl" style={{ bottom: inset, left: inset }} />
      <span className="bracket bracket-br" style={{ bottom: inset, right: inset }} />
    </div>
  );
}

// ─── Measurement divider ────────────────────────────────────────────────────────

function MeasureLine({ label }: { label?: string }) {
  const [ref, visible] = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="measure-line">
      <svg width="100%" height="10" preserveAspectRatio="none" className={`measure-svg ${visible ? "draw" : ""}`}>
        <line x1="0" y1="5" x2="100%" y2="5" />
      </svg>
      {label && <span className="measure-label">{label}</span>}
    </div>
  );
}

// ─── Image Gallery ────────────────────────────────────────────────────────────

function ImageGallery({ images }: { images: string[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const close = useCallback(() => setLightboxIdx(null), []);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setLightboxIdx((p) => (p === null ? p : (p + 1) % images.length));
      if (e.key === "ArrowLeft") setLightboxIdx((p) => (p === null ? p : (p - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, images.length, close]);

  if (images.length === 0) {
    return (
      <div className="gallery-empty">
        <Building2 size={40} strokeWidth={1.25} />
        <p>No images uploaded yet</p>
      </div>
    );
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        // user cancelled share sheet
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  };

  const thumbs = images.slice(1, 5);
  const extraCount = images.length - 5;

  return (
    <>
      <div className="gallery-grid">
        <div className="gallery-hero" onClick={() => setLightboxIdx(0)}>
          <img src={images[0]} alt="Project 1" />
          <Brackets />
          <div className="gallery-hero-actions">
            <button type="button" onClick={handleShare} aria-label="Share">
              <Share2 size={15} />
            </button>
            <a href={images[0]} download onClick={(e) => e.stopPropagation()} aria-label="Download image">
              <Download size={15} />
            </a>
          </div>
        </div>

        {thumbs.length > 0 && (
          <div className="gallery-thumbs-grid">
            {thumbs.map((url, i) => {
              const showOverlay = i === thumbs.length - 1 && extraCount > 0;
              return (
                <div key={i} className="gallery-thumb" onClick={() => setLightboxIdx(i + 1)}>
                  <img src={url} alt={`Project ${i + 2}`} />
                  {showOverlay && (
                    <div className="gallery-thumb-overlay">
                      <Images size={18} />
                      <span>{extraCount} more</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lightboxIdx !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="lightbox" onClick={close}>
            <button className="lb-close" onClick={close}>
              <X size={20} />
            </button>
            <button
              className="lb-nav lb-prev"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIdx((p) => (p === null ? p : (p - 1 + images.length) % images.length));
              }}
            >
              <ChevronLeft size={26} />
            </button>
            <img src={images[lightboxIdx]} alt="" onClick={(e) => e.stopPropagation()} />
            <button
              className="lb-nav lb-next"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIdx((p) => (p === null ? p : (p + 1) % images.length));
              }}
            >
              <ChevronRight size={26} />
            </button>
            {images.length > 1 && (
              <div className="lb-thumbs" onClick={(e) => e.stopPropagation()}>
                {images.map((url, i) => (
                  <button
                    key={i}
                    className={i === lightboxIdx ? "active" : ""}
                    onClick={() => setLightboxIdx(i)}
                    aria-label={`Go to image ${i + 1}`}
                  >
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            )}

            <div className="lb-count">
              {String(lightboxIdx + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// ─── Info strip ───────────────────────────────────────────────────────────────

function InfoItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string }) {
  if (!value || value === "—") return null;
  return (
    <div className="info-item">
      <Icon size={15} strokeWidth={1.75} />
      <div>
        <p className="info-label">{label}</p>
        <p className="info-value">{value}</p>
      </div>
    </div>
  );
}

// ─── Contact / title-block card ────────────────────────────────────────────────

function ContactCard({ project }: { project: ProjectPreview }) {
  const tenant = project.tenant;
  const initial = (tenant?.companyName || project.projectName || "P").charAt(0).toUpperCase();

  const refPrefix = (project.projectSubType?.slice(0, 3) || project.status?.slice(0, 3) || "PRJ").toUpperCase();
  const refCode = project.id ? project.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() : "000000";
  const reraDoc = project.documents?.find((d) => /rera/i.test(d.name));
  const registrationLabel = reraDoc ? "RERA REG." : (project.status || "UNVERIFIED").toUpperCase();

  return (
    <div className="contact-card">
      <div className="contact-head">
        <div className="contact-avatar">{initial}</div>
        <div>
          <p className="contact-name">{tenant?.companyName || "Get in touch"}</p>
          <p className="contact-role">Property Consultant</p>
        </div>
      </div>

      <div className="contact-stats">
        <div>
          <p className="stat-label">Status</p>
          <p className="stat-value">{project.projectStatus || "—"}</p>
        </div>
        <div>
          <p className="stat-label">Possession</p>
          <p className="stat-value">{formatMonth(project.possessionDate)}</p>
        </div>
      </div>

      <div className="contact-actions">
        {tenant?.phone && (
          <a href={`tel:${tenant.phone}`} className="btn-call">
            <span className="pulse-ring" />
            <Phone size={16} />
            <span>
              <em>Call now</em>
              {tenant.phone}
            </span>
          </a>
        )}
        {tenant?.email && (
          <a href={`mailto:${tenant.email}`} className="btn-email">
            <Mail size={16} />
            <span>
              <em>Email</em>
              {tenant.email}
            </span>
          </a>
        )}
        {!tenant?.phone && !tenant?.email && (
          <div style={{ textAlign: "center", padding: "16px 0", color: "var(--muted)" }}>
            <CheckCircle2 size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
            <p style={{ fontSize: 13, margin: 0 }}>Contact details unavailable</p>
          </div>
        )}
      </div>

      {project.brochureUrl && (
        <div className="contact-brochure">
          <p className="stat-label">Brochure</p>
          <a href={project.brochureUrl} target="_blank" rel="noopener noreferrer" className="brochure-link">
            <FileText size={17} />
            <span>
              Download brochure
              <em>PDF Document</em>
            </span>
            <Download size={14} />
          </a>
        </div>
      )}

      <div className="title-block">
        <div>
          <span>SCALE</span>NTS
        </div>
        <div>
          <span>REF</span>
          {refPrefix}-{refCode}
        </div>
        <div>
          <span>STATUS</span>
          {registrationLabel}
        </div>
      </div>
    </div>
  );
}

// ─── Video Section ────────────────────────────────────────────────────────────

function VideoSection({ links }: { links: string[] }) {
  const [active, setActive] = useState(0);
  if (links.length === 0) return null;
  const link = links[active];
  const ytId = getYouTubeId(link);

  return (
    <section className="section">
      <h2 className="section-title">
        <Play size={16} /> Project walk-through
      </h2>
      <div className="video-grid">
        <div className="video-main">
          {ytId ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Project video"
            />
          ) : (
            <video src={link} controls />
          )}
        </div>
        {links.length > 1 && (
          <div className="video-thumbs">
            {links.map((l, i) => {
              const id = getYouTubeId(l);
              return (
                <button key={i} className={i === active ? "active" : ""} onClick={() => setActive(i)}>
                  {id ? <img src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`} alt="" /> : <Play size={18} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Ambient 3D background ─────────────────────────────────────────────────────

function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 18;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const makeField = (count: number, spread: [number, number, number], color: string, size: number, opacity: number) => {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * spread[0];
        positions[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
        positions[i * 3 + 2] = (Math.random() - 0.5) * spread[2];
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: new THREE.Color(color),
        size,
        transparent: true,
        opacity,
        sizeAttenuation: true,
      });
      return { points: new THREE.Points(geometry, material), geometry, material };
    };

    const brass = makeField(220, [42, 24, 18], "#A97C50", 0.09, 0.45);
    const pine = makeField(130, [48, 28, 26], "#33473B", 0.06, 0.28);
    scene.add(brass.points);
    scene.add(pine.points);
    pine.points.position.z = -6;

    let mouseX = 0;
    let mouseY = 0;
    const onPointerMove = (e: PointerEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!prefersReducedMotion) window.addEventListener("pointermove", onPointerMove);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const clock = new THREE.Clock();

    const renderFrame = () => renderer.render(scene, camera);

    const animate = () => {
      const t = clock.getElapsedTime();
      brass.points.rotation.y = t * 0.015;
      brass.points.rotation.x = t * 0.006;
      pine.points.rotation.y = -t * 0.008;
      camera.position.x += (mouseX * 1.2 - camera.position.x) * 0.02;
      camera.position.y += (-mouseY * 0.8 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);
      renderFrame();
      raf = requestAnimationFrame(animate);
    };

    if (prefersReducedMotion) {
      renderFrame();
    } else {
      raf = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      brass.geometry.dispose();
      brass.material.dispose();
      pine.geometry.dispose();
      pine.material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="three-bg" aria-hidden="true" />;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

function PreviewStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,340;0,9..144,480;0,9..144,600;1,9..144,480;1,9..144,560&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

      .preview-root {
        --paper: #FAF7F1;
        --paper-dim: #F1EAD9;
        --ink: #1C2620;
        --ink-soft: #4E5A50;
        --brass: #A97C50;
        --brass-dark: #8A6440;
        --pine: #33473B;
        --pine-light: #5C7663;
        --line: #DCD3BE;
        --muted: #948E7D;
        --sold: #A6473A;
        --reserved: #B8894A;
        font-family: 'Inter', sans-serif;
        background: var(--paper);
        color: var(--ink);
        min-height: 100vh;
        position: relative;
      }
      .preview-root * { box-sizing: border-box; }
      .mono { font-family: 'IBM Plex Mono', monospace; }

      .three-bg {
        position: fixed; inset: 0; pointer-events: none; z-index: 0;
        mask-image: radial-gradient(ellipse 85% 65% at 50% 0%, black 25%, transparent 80%);
        -webkit-mask-image: radial-gradient(ellipse 85% 65% at 50% 0%, black 25%, transparent 80%);
      }
      .three-bg canvas { display: block; width: 100% !important; height: 100% !important; }

      .wrap { max-width: 1180px; margin: 0 auto; padding: 40px 24px 80px; position: relative; z-index: 1; }

      /* ── header ── */
      .header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 28px; }
      .fade-up { opacity: 0; transform: translateY(14px); transition: opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1); }
      .loaded .fade-up { opacity: 1; transform: translateY(0); }
      .pills { display: flex; gap: 8px; margin-bottom: 10px; }
      .pill { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); background: #fff; color: var(--ink-soft); }
      .pill.brass { color: var(--brass-dark); border-color: color-mix(in srgb, var(--brass) 40%, var(--line)); background: color-mix(in srgb, var(--brass) 8%, white); }
      .pill.pine { color: var(--pine); border-color: color-mix(in srgb, var(--pine) 35%, var(--line)); background: color-mix(in srgb, var(--pine) 8%, white); }
      .h1 { font-family: 'Fraunces', serif; font-weight: 480; font-style: italic; font-size: clamp(32px, 4.4vw, 50px); line-height: 1.02; letter-spacing: -0.01em; margin: 0; }
      .meta-row { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 12px; color: var(--ink-soft); font-size: 13.5px; }
      .meta-row span { display: inline-flex; align-items: center; gap: 6px; }
      .meta-row svg { color: var(--brass); }

      /* ── layout ── */
      .col-main { display: flex; flex-direction: column; gap: 40px; }
      .contact-card-wrap { max-width: 420px; }

      /* ── reveal ── */
      .reveal { opacity: 0; transform: translateY(22px); transition: opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1); }
      .reveal-in { opacity: 1; transform: translateY(0); }

      /* ── brackets (signature element) ── */
      .brackets { position: absolute; inset: 0; pointer-events: none; }
      .bracket { position: absolute; width: 22px; height: 22px; opacity: 0; transition: opacity .35s ease, transform .35s ease; }
      .bracket-tl { border-top: 2px solid #fff; border-left: 2px solid #fff; transform: translate(4px,4px); }
      .bracket-tr { border-top: 2px solid #fff; border-right: 2px solid #fff; transform: translate(-4px,4px); }
      .bracket-bl { border-bottom: 2px solid #fff; border-left: 2px solid #fff; transform: translate(4px,-4px); }
      .bracket-br { border-bottom: 2px solid #fff; border-right: 2px solid #fff; transform: translate(-4px,-4px); }
      .gallery-hero:hover .bracket, .field-frame:hover .bracket { opacity: .85; transform: translate(0,0); }

      /* ── gallery ── */
      .gallery-grid { display: grid; grid-template-columns: 1.7fr 1fr 1fr; grid-template-rows: repeat(2, 1fr); gap: 10px; height: 420px; }
      .gallery-hero { position: relative; grid-column: 1; grid-row: 1 / 3; overflow: hidden; border-radius: 4px; cursor: pointer; background: var(--paper-dim); }
      .gallery-hero img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s cubic-bezier(.2,.7,.2,1); }
      .gallery-hero:hover img { transform: scale(1.03); }
      .gallery-thumbs-grid { display: contents; }
      .gallery-thumb { position: relative; overflow: hidden; border-radius: 4px; cursor: pointer; background: var(--paper-dim); }
      .gallery-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s cubic-bezier(.2,.7,.2,1); }
      .gallery-thumb:hover img { transform: scale(1.05); }
      .gallery-thumb-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: rgba(20,24,20,0.55); backdrop-filter: blur(3px); color: #fff; font-size: 12.5px; font-family: 'IBM Plex Mono', monospace; }
      .gallery-thumb:has(.gallery-thumb-overlay) > img { filter: blur(3px) brightness(.7); }
      .gallery-hero-actions { position: absolute; top: 14px; left: 14px; display: flex; gap: 8px; z-index: 2; }
      .gallery-hero-actions button, .gallery-hero-actions a { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: rgba(20,24,20,0.55); backdrop-filter: blur(4px); color: #fff; border: none; cursor: pointer; transition: background .2s ease; }
      .gallery-hero-actions button:hover, .gallery-hero-actions a:hover { background: rgba(20,24,20,0.8); }
      .gallery-empty { aspect-ratio: 16/6; border-radius: 4px; background: var(--paper-dim); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--muted); }
      @media (max-width: 720px) {
        .gallery-grid { grid-template-columns: 1fr; grid-template-rows: 220px repeat(2, 110px); height: auto; }
        .gallery-hero { grid-column: 1; grid-row: 1; }
        .gallery-thumbs-grid { display: grid; grid-column: 1; grid-row: 2 / 4; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); gap: 10px; }
      }

      .lightbox { position: fixed; inset: 0; background: rgba(28,38,32,0.55); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 60; display: flex; align-items: center; justify-content: center; animation: fadeIn .2s ease; }
      @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      .lightbox img { max-height: 92vh; width: 100%; max-width: 100vw; object-fit: contain; border-radius: 10px; box-shadow: 0 24px 64px rgba(0,0,0,0.35); }
      .lb-close, .lb-nav { position: absolute; background: rgba(20,24,20,0.55); border: none; color: #fff; border-radius: 999px; padding: 11px; cursor: pointer; transition: background .2s ease, transform .15s ease; box-shadow: 0 4px 14px rgba(0,0,0,0.2); }
      .lb-close:hover, .lb-nav:hover { background: rgba(20,24,20,0.8); transform: scale(1.06); }
      .lb-prev:hover, .lb-next:hover { transform: translateY(-50%) scale(1.06); }
      .lb-close { top: 20px; right: 20px; }
      .lb-prev { left: 20px; top: 50%; transform: translateY(-50%); }
      .lb-next { right: 20px; top: 50%; transform: translateY(-50%); }
      .lb-count { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.55); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; letter-spacing: .08em; }
      .lb-thumbs { position: absolute; bottom: 46px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; max-width: min(90vw, 760px); overflow-x: auto; padding: 4px; }
      .lb-thumbs button { flex: 0 0 62px; aspect-ratio: 4/3; border-radius: 4px; overflow: hidden; padding: 0; border: 2px solid transparent; cursor: pointer; opacity: .5; transition: opacity .2s ease, border-color .2s ease; background: none; }
      .lb-thumbs button.active { opacity: 1; border-color: var(--brass); }
      .lb-thumbs button:hover { opacity: .85; }
      .lb-thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }

      /* ── measure line ── */
      .measure-line { position: relative; margin: 0; display: flex; align-items: center; gap: 10px; }
      .measure-svg line { stroke: var(--line); stroke-width: 1; stroke-dasharray: 4 4; }
      .measure-svg.draw line { stroke-dasharray: 1400; stroke-dashoffset: 1400; animation: drawline 1.1s ease forwards; }
      @keyframes drawline { to { stroke-dashoffset: 0; } }
      .measure-label { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: .1em; color: var(--muted); white-space: nowrap; text-transform: uppercase; }

      /* ── info strip ── */
      .info-panel { background: #fff; border: 1px solid var(--line); border-radius: 4px; padding: 22px 26px; }
      .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; }
      .info-item { display: flex; gap: 11px; align-items: flex-start; }
      .info-item svg { color: var(--brass); margin-top: 3px; flex-shrink: 0; }
      .info-label { font-size: 10px; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); font-family: 'IBM Plex Mono', monospace; margin: 0; }
      .info-value { font-size: 14.5px; font-weight: 600; color: var(--ink); margin: 3px 0 0; }

      /* ── section headers ── */
      .section { display: flex; flex-direction: column; gap: 16px; }
      .section-title { font-family: 'Fraunces', serif; font-weight: 500; font-size: 21px; display: flex; align-items: center; gap: 9px; margin: 0; color: var(--ink); }
      .section-title svg { color: var(--brass); }

      /* ── about ── */
      .about-panel { background: #fff; border: 1px solid var(--line); border-radius: 4px; padding: 26px 30px; }
      .about-panel p { font-size: 15px; line-height: 1.75; color: var(--ink-soft); margin: 0; white-space: pre-wrap; }
      .about-panel p::first-letter { font-family: 'Fraunces', serif; font-style: italic; font-size: 46px; float: left; line-height: 0.8; padding: 6px 8px 0 0; color: var(--brass-dark); }

      /* ── amenities ── */
      .amenity-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 14px; }
      .amenity { display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 18px 8px; border-radius: 4px; border: 1px solid var(--line); background: #fff; transition: border-color .25s ease, transform .25s ease; }
      .amenity:hover { border-color: var(--brass); transform: translateY(-3px); }
      .amenity-icon { width: 42px; height: 42px; border-radius: 50%; border: 1.5px solid var(--line); display: flex; align-items: center; justify-content: center; color: var(--pine); transition: border-color .25s ease, color .25s ease; }
      .amenity:hover .amenity-icon { border-color: var(--brass); color: var(--brass-dark); }
      .amenity span { font-size: 11px; text-align: center; color: var(--ink-soft); font-weight: 500; line-height: 1.3; }

      /* ── documents ── */
      .doc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
      .doc-card { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border: 1px dashed var(--line); border-radius: 4px; background: #fff; text-decoration: none; color: inherit; transition: border-color .2s ease, background .2s ease; }
      .doc-card:hover { border-color: var(--brass); background: var(--paper-dim); }
      .doc-icon { width: 34px; height: 34px; border-radius: 6px; background: color-mix(in srgb, var(--brass) 12%, white); color: var(--brass-dark); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .doc-name { font-size: 13.5px; font-weight: 600; margin: 0; color: var(--ink); }
      .doc-file { font-size: 10.5px; color: var(--muted); margin: 2px 0 0; font-family: 'IBM Plex Mono', monospace; }

      /* ── video ── */
      .video-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
      .video-main { aspect-ratio: 16/9; border-radius: 4px; overflow: hidden; background: #000; }
      .video-main iframe, .video-main video { width: 100%; height: 100%; border: 0; }
      .video-thumbs { display: flex; flex-direction: column; gap: 8px; }
      .video-thumbs button { border: 2px solid transparent; border-radius: 4px; overflow: hidden; padding: 0; cursor: pointer; aspect-ratio: 16/9; background: var(--paper-dim); display: flex; align-items: center; justify-content: center; color: var(--muted); }
      .video-thumbs button.active { border-color: var(--brass); }
      .video-thumbs img { width: 100%; height: 100%; object-fit: cover; }
      @media (max-width: 700px) { .video-grid { grid-template-columns: 1fr; } .video-thumbs { flex-direction: row; overflow-x: auto; } .video-thumbs button { flex: 0 0 120px; } }

      /* ── units table ── */
      .table-panel { background: #fff; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }
      table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
      thead tr { background: var(--paper-dim); }
      th { text-align: left; padding: 12px 16px; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-family: 'IBM Plex Mono', monospace; font-weight: 600; }
      td { padding: 13px 16px; border-top: 1px solid var(--line); color: var(--ink-soft); }
      td.code { font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: var(--ink); }
      td.price { font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: var(--ink); }
      tbody tr { transition: background .15s ease; }
      tbody tr:hover { background: var(--paper-dim); }
      .status-tag { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
      .status-tag.available { color: var(--pine); background: color-mix(in srgb, var(--pine) 12%, white); }
      .status-tag.sold { color: var(--sold); background: color-mix(in srgb, var(--sold) 12%, white); }
      .status-tag.reserved { color: var(--reserved); background: color-mix(in srgb, var(--reserved) 14%, white); }
      .table-foot { padding: 12px 16px; text-align: center; font-size: 12px; color: var(--muted); border-top: 1px solid var(--line); background: var(--paper-dim); }

      /* ── contact card ── */
      .contact-card { background: #fff; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
      .contact-head { display: flex; gap: 12px; align-items: center; padding: 22px 22px 20px; background: linear-gradient(150deg, var(--ink) 0%, #26332B 100%); position: relative; overflow: hidden; }
      .contact-head::after { content: ''; position: absolute; width: 140px; height: 140px; background: radial-gradient(circle, rgba(169,124,80,0.35), transparent 70%); top: -50px; right: -50px; }
      .contact-avatar { width: 46px; height: 46px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Fraunces', serif; font-size: 18px; flex-shrink: 0; position: relative; z-index: 1; }
      .contact-name { color: #fff; font-weight: 600; font-size: 14.5px; margin: 0; position: relative; z-index: 1; }
      .contact-role { color: rgba(255,255,255,0.5); font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; margin: 3px 0 0; position: relative; z-index: 1; font-family: 'IBM Plex Mono', monospace; }
      .contact-stats { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--line); }
      .contact-stats > div { padding: 14px; text-align: center; }
      .contact-stats > div:first-child { border-right: 1px solid var(--line); }
      .stat-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-family: 'IBM Plex Mono', monospace; margin: 0; }
      .stat-value { font-size: 13.5px; font-weight: 700; margin: 4px 0 0; }
      .contact-actions { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
      .btn-call, .btn-email { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-radius: 6px; text-decoration: none; transition: transform .15s ease; position: relative; }
      .btn-call { background: var(--ink); color: #fff; }
      .btn-email { border: 1px solid var(--line); color: var(--ink); }
      .btn-call:hover, .btn-email:hover { transform: translateY(-1px); }
      .btn-call span, .btn-email span { display: flex; flex-direction: column; font-size: 13.5px; font-weight: 600; }
      .btn-call em, .btn-email em { font-style: normal; font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em; opacity: .6; font-family: 'IBM Plex Mono', monospace; margin-bottom: 2px; }
      .pulse-ring { position: absolute; left: 27px; top: 50%; width: 30px; height: 30px; margin-top: -15px; border-radius: 50%; border: 1.5px solid var(--brass); opacity: 0; animation: pulse 2.4s ease-out infinite; }
      @keyframes pulse { 0% { opacity: .55; transform: scale(0.6); } 100% { opacity: 0; transform: scale(1.5); } }
      .contact-brochure { padding: 0 20px 20px; }
      .brochure-link { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border: 1px dashed var(--line); border-radius: 6px; text-decoration: none; color: var(--ink); margin-top: 8px; transition: border-color .2s ease, background .2s ease; }
      .brochure-link:hover { border-color: var(--brass); background: var(--paper-dim); }
      .brochure-link span { flex: 1; display: flex; flex-direction: column; font-size: 13px; font-weight: 600; }
      .brochure-link em { font-style: normal; font-size: 10px; color: var(--muted); font-weight: 400; margin-top: 1px; }
      .title-block { border-top: 1px solid var(--line); padding: 14px 20px; display: flex; justify-content: space-between; background: var(--paper-dim); }
      .title-block div { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--ink-soft); display: flex; flex-direction: column; gap: 2px; }
      .title-block span { font-size: 8.5px; color: var(--muted); letter-spacing: .06em; }

      /* ── footer ── */
      .footer { margin-top: 24px; padding-top: 22px; border-top: 1px solid var(--line); text-align: center; }
      .footer p { font-size: 11.5px; color: var(--muted); margin: 0; }

      /* ── loading / error states ── */
      .skeleton-block { background: var(--paper-dim); border-radius: 4px; position: relative; overflow: hidden; }
      .skeleton-block::after {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
        animation: shimmer 1.6s ease-in-out infinite;
      }
      @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
      .state-center { min-height: 60vh; display: flex; align-items: center; justify-content: center; text-align: center; }
      .state-center svg { color: var(--muted); margin: 0 auto 14px; }
      .state-center h2 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 22px; margin: 0 0 6px; color: var(--ink); }
      .state-center p { font-size: 13.5px; color: var(--ink-soft); margin: 0; }

      @media (prefers-reduced-motion: reduce) {
        .reveal, .fade-up, .bracket, .measure-svg.draw line, .pulse-ring, .carousel-slide img, .carousel-track { transition: none !important; animation: none !important; }
        .reveal, .fade-up { opacity: 1 !important; transform: none !important; }
      }
    `}</style>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectPreviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loaded, setLoaded] = useState(false);

  const {
    data: project,
    isLoading,
    isError,
  } = useQuery<ProjectPreview>({
    queryKey: ["project-preview", slug],
    queryFn: () => projectApi.getProjectPreview(slug),
    enabled: !!slug,
  });

  useEffect(() => {
    if (isLoading || !project) return;
    const t = setTimeout(() => setLoaded(true), 60);
    return () => clearTimeout(t);
  }, [isLoading, project]);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="preview-root">
        <PreviewStyles />
        <ThreeBackground />
        <div className="wrap">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="skeleton-block" style={{ width: 220, height: 30 }} />
            <div className="skeleton-block" style={{ width: 160, height: 14 }} />
            <div className="skeleton-block" style={{ aspectRatio: "16/7", width: "100%" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton-block" style={{ height: 80 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (isError || !project) {
    return (
      <div className="preview-root">
        <PreviewStyles />
        <ThreeBackground />
        <div className="wrap">
          <div className="state-center" style={{ flexDirection: "column" }}>
            <Building2 size={56} strokeWidth={1.25} />
            <h2>Project Not Found</h2>
            <p>This project preview is unavailable or hasn&apos;t been published yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const allAmenities = [...(project.basicAmenities ?? []), ...(project.featuredAmenities ?? [])];

  return (
    <div className="preview-root">
      <PreviewStyles />
      <ThreeBackground />

      <div className={`wrap ${loaded ? "loaded" : ""}`}>
        {/* header */}
        <div className="header">
          <div className="fade-up" style={{ transitionDelay: "40ms" }}>
            <div className="pills">
              {project.projectSubType && <span className="pill brass">{project.projectSubType}</span>}
              {project.projectStatus && <span className="pill pine">{project.projectStatus}</span>}
            </div>
            <h1 className="h1">{project.projectName}</h1>
            <div className="meta-row">
              {project.builderName && (
                <span>
                  <Building2 size={14} /> {project.builderName}
                </span>
              )}
              {project.city && (
                <span>
                  <MapPin size={14} /> {project.city}
                  {project.landmark ? `, ${project.landmark}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="col-main">
          <div className="fade-up" style={{ transitionDelay: "140ms" }}>
            <ImageGallery images={project.imageUrls ?? []} />
          </div>

          <Reveal delay={100} className="contact-card-wrap">
            <ContactCard project={project} />
          </Reveal>

          <MeasureLine label="Project specifications" />

            <Reveal>
              <div className="info-panel">
                <div className="info-grid">
                  <InfoItem icon={Layers} label="Project status" value={project.projectStatus} />
                  <InfoItem icon={CalendarClock} label="Possession date" value={formatMonth(project.possessionDate)} />
                  <InfoItem icon={Compass} label="Facings" value={project.facings?.join(", ")} />
                  <InfoItem icon={Building2} label="Project sub type" value={project.projectSubType} />
                  <InfoItem
                    icon={LandPlot}
                    label="Project land area"
                    value={
                      project.projectLandArea
                        ? `${project.projectLandArea} ${project.projectLandUnit || "sq ft"}`
                        : undefined
                    }
                  />
                  <InfoItem icon={CalendarClock} label="Start date" value={formatDate(project.startDate)} />
                  <InfoItem icon={CalendarCheck2} label="End date" value={formatDate(project.endDate)} />
                </div>
              </div>
            </Reveal>

            {project.description && (
              <Reveal className="section">
                <h2 className="section-title">About the project</h2>
                <div className="about-panel">
                  <p>{project.description}</p>
                </div>
              </Reveal>
            )}

            {allAmenities.length > 0 && (
              <Reveal className="section">
                <h2 className="section-title">Amenities</h2>
                <div className="amenity-grid">
                  {allAmenities.map((a) => {
                    const Icon = getAmenityIcon(a);
                    return (
                      <div key={a} className="amenity">
                        <div className="amenity-icon">
                          <Icon size={18} strokeWidth={1.6} />
                        </div>
                        <span>{a}</span>
                      </div>
                    );
                  })}
                </div>
              </Reveal>
            )}

            {project.documents && project.documents.length > 0 && (
              <Reveal className="section">
                <h2 className="section-title">Documents</h2>
                <div className="doc-grid">
                  {project.documents.map((doc) => (
                    <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer" className="doc-card">
                      <div className="doc-icon">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="doc-name">{doc.name}</p>
                        <p className="doc-file">{doc.fileName}</p>
                      </div>
                      <Download size={13} style={{ marginLeft: "auto", color: "var(--muted)" }} />
                    </a>
                  ))}
                </div>
              </Reveal>
            )}

            <Reveal>
              <VideoSection links={project.videoLinks ?? []} />
            </Reveal>

            {project.properties && project.properties.length > 0 && (
              <Reveal className="section">
                <h2 className="section-title">Available units</h2>
                <div className="table-panel">
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Unit</th>
                          <th>Block</th>
                          <th>Type</th>
                          <th>Size</th>
                          <th>Facing</th>
                          <th>Price</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.properties.slice(0, 20).map((p) => (
                          <tr key={p.id}>
                            <td className="code">{p.propertyCode || "—"}</td>
                            <td>{p.block || "—"}</td>
                            <td>{p.property_type || "—"}</td>
                            <td>{p.plotSize ? `${p.plotSize} sq ft` : "—"}</td>
                            <td>{p.facing || "—"}</td>
                            <td className="price">{p.price ? `₹${Number(p.price).toLocaleString("en-IN")}` : "—"}</td>
                            <td>
                              <span className={`status-tag ${statusClass(p.status)}`}>{p.status || "—"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {project.properties.length > 20 && (
                    <div className="table-foot">
                      Showing 20 of {project.properties.length} units. Contact us for the full inventory.
                    </div>
                  )}
                </div>
              </Reveal>
            )}
        </div>

        <div className="footer">
          <p>
            © {new Date().getFullYear()} {project.tenant?.companyName || project.projectName}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
