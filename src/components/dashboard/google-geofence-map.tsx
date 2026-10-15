"use client";

/**
 * Google Maps polygon editor for the geofence screen: Google map tiles,
 * Google Places autocomplete search, click-to-draw vertices — the exact
 * search experience of google.com/maps.
 *
 * Interactions match the previous editor: click the map to add a point, drag
 * a point to adjust, right-click a point to remove. Other zones render
 * read-only for context.
 *
 * Requires "Maps JavaScript API" + "Places API (New)" enabled on the key
 * (see src/lib/google-maps.ts); until then an explanatory overlay is shown.
 */
import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/src/api/api";
import type { FenceOverlay } from "@/src/components/dashboard/dispatch-map";
import {
  fetchPlaceSuggestions,
  loadGoogleMaps,
  onGoogleMapsAuthFailure,
  type PlaceSuggestion,
} from "@/src/lib/google-maps";
import { fetchPlaceBoundary, type BoundaryRing } from "@/src/lib/place-boundary";
import { MapPinIcon, SearchIcon, SpinnerIcon } from "@/src/components/icons";

export type { FenceOverlay } from "@/src/components/dashboard/dispatch-map";

/** Fallback view when there is nothing to fit yet (New Delhi). */
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const DEFAULT_ZOOM = 11;

/** Google-Maps-style highlight for a searched area's boundary. */
const BOUNDARY_COLOR = "#DB4437";
/**
 * Dash segment for the boundary outline. Polygons can't dash natively, so a
 * zero-opacity Polyline repeats this short stroke along the ring instead.
 */
const BOUNDARY_DASH: google.maps.IconSequence = {
  icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeWeight: 2, scale: 2.5 },
  offset: "0",
  repeat: "12px",
};

/** Ref that always holds the latest value — for handlers wired up once. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

function vertexIcon(color: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 6,
    fillColor: "#ffffff",
    fillOpacity: 1,
    strokeColor: color,
    strokeWeight: 3,
  };
}

/* ------------------------------ Search box ------------------------------- */

/**
 * Google Places autocomplete overlaid on the map: type a place, pick a match,
 * and the map flies there so the admin can start drawing the fence.
 */
function PlaceSearchBox({ onSelect }: { onSelect: (s: PlaceSuggestion) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const seqRef = useRef(0); // drop responses from superseded keystrokes

  useEffect(() => {
    const q = query.trim();
    const seq = ++seqRef.current;
    if (q.length < 3) {
      // Deferred so we never set state synchronously inside the effect body.
      queueMicrotask(() => {
        if (seq !== seqRef.current) return;
        setResults([]);
        setLoading(false);
        setError(false);
      });
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const found = await fetchPlaceSuggestions(q);
        if (seq !== seqRef.current) return;
        setResults(found);
        setOpen(true);
        setLoading(false);
      } catch {
        if (seq !== seqRef.current) return;
        setError(true);
        setResults([]);
        setOpen(true);
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close the dropdown when clicking outside the box.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (s: PlaceSuggestion) => {
    onSelect(s);
    setQuery(s.label);
    setResults([]);
    setOpen(false);
  };

  const showDropdown = open && query.trim().length >= 3;

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (results[0]) pick(results[0]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search a place or address…"
          aria-label="Search for a location"
          className="w-full rounded-xl border border-border bg-card/95 py-2 pl-10 pr-9 text-sm text-foreground shadow-md outline-none backdrop-blur placeholder:text-muted-foreground transition focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
        {loading && (
          <SpinnerIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          {error ? (
            <p className="px-3 py-2.5 text-sm text-danger">
              Search failed — is a Places API enabled for this key?
            </p>
          ) : loading && results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">No matches found.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-accent"
                  >
                    <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {r.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.address}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Map editor ------------------------------- */

export function GeofenceMapEditor({
  polygon,
  onChange,
  color,
  otherFences = [],
  className = "h-full min-h-105",
}: {
  polygon: LatLng[];
  onChange: (polygon: LatLng[]) => void;
  color: string;
  otherFences?: FenceOverlay[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const shapeRef = useRef<google.maps.Polygon | google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const contextShapesRef = useRef<google.maps.Polygon[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const didFitRef = useRef(false);
  const boundaryShapesRef = useRef<(google.maps.Polygon | google.maps.Polyline)[]>([]);
  const boundarySeqRef = useRef(0); // drop boundary results from superseded picks
  const [authError, setAuthError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [boundaryStatus, setBoundaryStatus] = useState<"idle" | "loading" | "none" | "error">(
    "idle",
  );

  // Latest state for handlers created once (map click) or per-draw (markers).
  const polygonRef = useLatest(polygon);
  const onChangeRef = useLatest(onChange);
  const colorRef = useLatest(color);
  const otherFencesRef = useLatest(otherFences);

  useEffect(() => {
    let cancelled = false;
    const offAuth = onGoogleMapsAuthFailure(() => setAuthError(true));
    (async () => {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = new g.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          clickableIcons: false, // POI clicks must not add stray vertices
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
        });
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          onChangeRef.current([
            ...polygonRef.current,
            { lat: +e.latLng.lat().toFixed(6), lng: +e.latLng.lng().toFixed(6) },
          ]);
        });
        infoRef.current = new g.maps.InfoWindow({ disableAutoPan: true });
        mapRef.current = map;
        drawContext();
        drawEditable();
        // Initial view: fit whatever exists (the zone being edited wins).
        const fit =
          polygonRef.current.length >= 2
            ? polygonRef.current
            : otherFencesRef.current.flatMap((f) => f.polygon);
        if (fit.length >= 2) {
          const bounds = new g.maps.LatLngBounds();
          fit.forEach((p) => bounds.extend(p));
          map.fitBounds(bounds, 40);
          didFitRef.current = true;
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "The Google Maps script failed to load.");
        }
      }
    })();
    return () => {
      cancelled = true;
      offAuth();
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      shapeRef.current?.setMap(null);
      shapeRef.current = null;
      contextShapesRef.current.forEach((s) => s.setMap(null));
      contextShapesRef.current = [];
      boundaryShapesRef.current.forEach((s) => s.setMap(null));
      boundaryShapesRef.current = [];
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawContext() {
    const map = mapRef.current;
    if (!map) return;
    contextShapesRef.current.forEach((s) => s.setMap(null));
    contextShapesRef.current = [];
    for (const fence of otherFencesRef.current) {
      if (fence.polygon.length < 3) continue;
      const shape = new google.maps.Polygon({
        paths: fence.polygon,
        strokeColor: fence.color,
        strokeWeight: 1.5,
        fillColor: fence.color,
        fillOpacity: 0.08,
        map,
      });
      // Zone name on hover, like the previous editor's sticky tooltip.
      shape.addListener("mouseover", (e: google.maps.MapMouseEvent) => {
        const info = infoRef.current;
        if (!info || !e.latLng) return;
        info.setContent(fence.name);
        info.setPosition(e.latLng);
        info.open({ map });
      });
      shape.addListener("mouseout", () => infoRef.current?.close());
      // Clicks on context zones still add vertices to the zone being drawn.
      shape.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        onChangeRef.current([
          ...polygonRef.current,
          { lat: +e.latLng.lat().toFixed(6), lng: +e.latLng.lng().toFixed(6) },
        ]);
      });
      contextShapesRef.current.push(shape);
    }
  }

  function drawEditable() {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    shapeRef.current?.setMap(null);
    shapeRef.current = null;

    const points = polygonRef.current;
    const c = colorRef.current;

    if (points.length >= 3) {
      shapeRef.current = new google.maps.Polygon({
        paths: points,
        strokeColor: c,
        strokeWeight: 2.5,
        fillColor: c,
        fillOpacity: 0.18,
        clickable: false,
        map,
      });
    } else if (points.length === 2) {
      shapeRef.current = new google.maps.Polyline({
        path: points,
        strokeColor: c,
        strokeWeight: 2.5,
        clickable: false,
        map,
      });
    }

    points.forEach((point, index) => {
      const marker = new google.maps.Marker({
        position: point,
        icon: vertexIcon(c),
        draggable: true,
        map,
      });
      marker.addListener("dragend", () => {
        const pos = marker.getPosition();
        if (!pos) return;
        const next = [...polygonRef.current];
        next[index] = { lat: +pos.lat().toFixed(6), lng: +pos.lng().toFixed(6) };
        onChangeRef.current(next);
      });
      marker.addListener("rightclick", () => {
        onChangeRef.current(polygonRef.current.filter((_, i) => i !== index));
      });
      markersRef.current.push(marker);
    });
  }

  // Redraw when the polygon / colour / context zones change.
  useEffect(() => {
    if (!mapRef.current) return;
    drawEditable();
    drawContext();
    if (!didFitRef.current && polygon.length >= 3) {
      const bounds = new google.maps.LatLngBounds();
      polygon.forEach((p) => bounds.extend(p));
      mapRef.current.fitBounds(bounds, 40);
      didFitRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygon, color, otherFences]);

  function clearBoundary() {
    boundaryShapesRef.current.forEach((s) => s.setMap(null));
    boundaryShapesRef.current = [];
  }

  /** Highlight a searched area like google.com/maps: dashed outline + tint. */
  function drawBoundary(rings: BoundaryRing[]) {
    const map = mapRef.current;
    if (!map) return;
    boundaryShapesRef.current.push(
      new google.maps.Polygon({
        paths: rings,
        strokeOpacity: 0,
        strokeWeight: 0,
        fillColor: BOUNDARY_COLOR,
        fillOpacity: 0.1,
        clickable: false, // clicks must still drop vertices on the map below
        map,
      }),
    );
    for (const ring of rings) {
      boundaryShapesRef.current.push(
        new google.maps.Polyline({
          path: [...ring, ring[0]], // close the ring
          strokeColor: BOUNDARY_COLOR,
          strokeOpacity: 0, // the repeated dash symbol draws the line instead
          icons: [BOUNDARY_DASH],
          clickable: false,
          map,
        }),
      );
    }
  }

  // Fly to a searched place so the admin can start drawing there, and
  // highlight the area's boundary when one exists.
  const flyTo = async (suggestion: PlaceSuggestion) => {
    const map = mapRef.current;
    if (!map) return;
    const seq = ++boundarySeqRef.current;
    clearBoundary();
    setBoundaryStatus("loading");
    let point: { lat: number; lng: number } | null = null;
    try {
      const { lat, lng, viewport } = await suggestion.resolve();
      if (seq !== boundarySeqRef.current) return; // superseded by a newer pick
      point = { lat, lng };
      if (viewport) map.fitBounds(viewport);
      else {
        map.panTo({ lat, lng });
        map.setZoom(15);
      }
    } catch {
      /* details fetch failed — keep the current view, still try the boundary */
    }
    try {
      const rings = await fetchPlaceBoundary(suggestion.label, suggestion.address, point);
      if (seq !== boundarySeqRef.current || !mapRef.current) return;
      if (!rings) {
        setBoundaryStatus("none");
        return;
      }
      drawBoundary(rings);
      const bounds = new google.maps.LatLngBounds();
      rings.forEach((ring) => ring.forEach((p) => bounds.extend(p)));
      mapRef.current.fitBounds(bounds, 40);
      setBoundaryStatus("idle");
    } catch {
      if (seq === boundarySeqRef.current) setBoundaryStatus("error");
    }
  };

  // "No boundary" / error notices dismiss themselves after a moment.
  useEffect(() => {
    if (boundaryStatus !== "none" && boundaryStatus !== "error") return;
    const timer = setTimeout(() => setBoundaryStatus("idle"), 4000);
    return () => clearTimeout(timer);
  }, [boundaryStatus]);

  const showBlocker = authError || !!loadError;

  return (
    <div className={`isolate relative z-0 w-full ${className}`}>
      <div ref={containerRef} className="h-full w-full rounded-2xl" />
      {/* Search overlay — clear of the map controls. */}
      {!showBlocker && (
        <div className="absolute left-3 right-3 top-3 z-10 sm:right-auto sm:w-96">
          <PlaceSearchBox onSelect={flyTo} />
          {boundaryStatus !== "idle" && (
            <div className="mt-1.5 flex w-fit items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-1.5 text-xs shadow-md backdrop-blur">
              {boundaryStatus === "loading" && (
                <>
                  <SpinnerIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Loading area boundary…</span>
                </>
              )}
              {boundaryStatus === "none" && (
                <span className="text-muted-foreground">
                  No boundary outline is available for this place.
                </span>
              )}
              {boundaryStatus === "error" && (
                <span className="text-danger">Couldn’t load the area boundary.</span>
              )}
            </div>
          )}
        </div>
      )}
      {showBlocker && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/90 p-6 text-center">
          <div className="max-w-md space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Google Maps couldn’t start
            </p>
            <p className="text-sm text-muted-foreground">
              {authError
                ? "Check the key in Admin → Configure → Map Configuration. Enable Maps JavaScript API and allow this website in its Google Cloud restrictions, then reload this page."
                : loadError}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
