# Booking animations

Set this in `.env.local` for local development and in the production build environment (or `.env.production`):

```env
NEXT_PUBLIC_SHOW_BOOKING_ANIMATIONS=true
```

Set it to `false` to hide both illustrations. An unset variable also disables them.
Restart the development server after changing it. For production, rebuild and
redeploy: Next.js embeds `NEXT_PUBLIC_` values into the browser bundle at build time.
`.env.local` overrides `.env.production` on a machine that has both, so keep them
consistent when testing production builds locally.

## Display rules

- Pending, confirmed or assigned (but not accepted): a waiting animation inside
  the booking card. No connection panel.
- Accepted with a professional: a connection panel above the active booking list.
- On the way / in progress: keep the panel and update its status copy.
- Completed, cancelled or rejected: remove the illustrations.
- Past Orders: no animations. Existing history and booking actions remain available.
- Several accepted bookings: use the panel's order buttons to choose a connection.
  If the selected booking finishes, the panel switches to another accepted booking,
  or disappears if none remain. The existing ten-second booking poll drives updates.

## Components and data

- `src/components/orders/booking-activity.tsx`: reusable top panel, SVG neighbourhood,
  route and waiting animation. Framer Motion animates the route, pins, radar and hover.
- `src/components/orders/connection-scene.tsx`: lazy-loaded Three.js rings and floating
  blocks. WebGL is optional; the SVG, labels and booking actions work without it.
- `src/lib/booking-activity.ts`: display rules and area-label helpers.
- `src/lib/features.ts`: environment feature flag.

The customer label uses the locality before `serviceCity` in `serviceAddress`, falling
back to `serviceCity`. The partner label uses the profile's `district` or `city`.
Map callouts also display the accepted professional's name and the restaurant name
from the signed-in customer's account profile. The panel accepts an optional
`restaurantName` prop; missing names use “Your service partner” / “Your restaurant”.
Missing labels read “Area not available”. These fields already come from the bookings
endpoint. The partner label is a profile area, not a reverse-geocoded GPS position.
The background and connecting path are illustrative: no geographic map, route
calculation, arrival estimate or device-location request is added.

Animations pause offscreen and in hidden browser tabs. Reduced-motion preferences
keep a static SVG design, and Three.js resources are disposed when the panel unmounts.
The shared canvas lifecycle also restores drawing after GPU context restoration,
reuses a paused canvas when scrolling, and skips CSS-hidden profile panels. Profile
dot waves use direct Three.js, avoiding the deprecated Clock in the Fiber renderer.
