---
name: Nutri-Trust
description: Smart Food Choices. Zero Waste.
colors:
  instrument-body: "#e9ebf1"
  instrument-body-dark: "#17171c"
  ink: "#111111"
  ink-inverse: "#ededed"
  hairline: "#d7dae3"
  hairline-dark: "#26262e"
  reading-safe: "#30a46c"
  reading-warning: "#f76b15"
  reading-danger: "#e5484d"
  entry-navy: "#050A16"
  entry-panel: "#101a2e"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.instrument-body}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
    typography: "{typography.label}"
  button-pressable:
    backgroundColor: "{colors.instrument-body}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-item:
    backgroundColor: "{colors.instrument-body}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  stat-tile:
    backgroundColor: "{colors.instrument-body}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-inset:
    backgroundColor: "{colors.instrument-body}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  chip-reading:
    backgroundColor: "{colors.instrument-body}"
    textColor: "{colors.reading-safe}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
    typography: "{typography.label}"
  dialog-surface:
    backgroundColor: "{colors.instrument-body}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
---

# Design System: Nutri-Trust

## Overview

**Creative North Star: "The Honest Instrument"**

Nutri-Trust looks like a calibrated measuring device, not a lifestyle app. The
body of the instrument is a single continuous neutral surface — every panel,
tile, card and control is carved from the same sheet, and depth comes only
from the way light falls across it. Nothing is tinted to attract attention.
Nothing floats on a different-coloured plate.

Colour enters only where the instrument reports a reading. Green, amber and
red are not brand colours; they are measurements of how close food is to
being wasted. Because the rest of the interface is deliberately colourless,
a single red badge is impossible to miss on a shelf of twenty items. This is
the visual expression of the product's first principle: the name is *trust*,
so the interface must never overstate what it knows. A surface that shouts
everywhere can't be believed when it shouts about something real.

The material is soft-UI — surfaces raise, lift under a cursor, and physically
press inward when clicked — but the tactility is disciplined rather than
decorative. Motion follows the same rule: it exists to confirm a physical
action or to make a number legible as it changes, and it stops entirely when
the operating system asks it to.

**Key Characteristics:**
- One continuous material; hierarchy from shadow, never from fill colour
- A greyscale instrument body with a strict three-colour readout
- Tactile controls that raise, lift, and press
- Mobile-first single column, capped at a hand's width
- Depth that survives both light and dark without changing its logic

## Colors

A greyscale instrument body carrying a strict traffic-light readout, plus one
bounded atmospheric scope at the entrance.

### Primary
- **Ink** (`#111111` light / `#ededed` dark): All text, icons, and the filled
  primary button. The only "brand" colour the system has, and it is simply
  the darkest available value. Inverts wholesale in dark mode.

### Secondary
- **Instrument Body** (`#e9ebf1` light / `#17171c` dark): The single surface
  colour. It is simultaneously the page background, the card background, and
  the neumorphic surface — these are deliberately the same value. Light mode
  sits off white and dark mode sits off black on purpose: a pure extreme
  leaves no room for the highlight edge that makes the material read.

### Tertiary — the readout
Reserved exclusively for measurement. Never decorative, never a brand accent.
- **Reading Safe** (`#30a46c`): Item is comfortably within life; freshness
  bar in a healthy state; a positive nutrition finding.
- **Reading Warning** (`#f76b15`): Expiring soon; a moderate nutrition concern.
- **Reading Danger** (`#e5484d`): Critical or expired; a high nutrition risk;
  a destructive action such as delete.

### Neutral
- **Hairline** (`#d7dae3` light / `#26262e` dark): Dividers and the faint
  borders inside readout panels. Deliberately near-invisible; the material's
  shadow does most of the separating.

### Entry scope (bounded exception — see Known Drift)
- **Entry Navy** (`#050A16`) and **Entry Panel** (`#101a2e`): The sign-in
  screen only, where the neumorphic tokens are re-tinted so the top-left
  light source survives against a dark backdrop.

### Named Rules

**The Readout Rule.** Colour is a measurement, not decoration. Green, amber
and red state how close something is to being wasted or how risky it is to
eat — nothing else, ever. If a colour on screen isn't reporting a reading,
it is a bug.

**The One Material Rule.** `--background`, `--card` and `--neu-surface` are
the same value and must stay that way. The moment a surface is tinted a
different shade from the page, the soft-UI illusion collapses into "a grey
box on a lighter grey page." Depth is shadow's job.

**The Earned Alarm Rule.** Because the body is colourless, red carries real
weight. Never spend it on anything the user cannot act on.

## Typography

**Display / Body / Label Font:** Inter (variable, weights 100–900), with
`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto` fallbacks.

**Character:** One neutral grotesque doing all the work, the way instrument
panels use a single legible face at many sizes rather than pairing a voice
against a workhorse. Personality comes from the extremes of the weight axis
and from tight negative tracking on large numerals, not from a second family.

### Hierarchy
- **Display** (700, 1.875rem, tracking −0.02em): Stat values — freshness
  percentage, critical count, streak days. The instrument's primary readouts.
- **Headline** (600, 1.5rem, tracking −0.02em): Screen and dialog titles.
- **Title** (700, 0.9375rem): Item names, card headings.
- **Body** (400, 0.875rem, line-height 1.5): Descriptions, recipe steps,
  chat, explanatory copy.
- **Label** (600, 0.625rem, tracking 0.1em, uppercase): Section eyebrows
  ("PANTRY FRESHNESS", "INGREDIENTS", "DAYS REMAINING") and status chips.
  The instrument's engraved panel markings.

### Named Rules

**The Engraved Label Rule.** Small uppercase labels are always ≥600 weight
with ≥0.1em tracking. Uppercase at small sizes without tracking is unreadable
on a phone, and this system uses uppercase constantly.

**The Big Number Rule.** A measured value gets Display weight and negative
tracking; its unit and caption stay Body or Label. The number is the reading;
the words around it are the engraving.

## Layout

Mobile-first, single column, capped at `max-w-md` (448px) and centred, so the
app holds its phone proportions even on a desktop monitor. The visible frame
is the instrument; the space beside it is not used.

Vertical rhythm runs on a 4px base, in practice `6 / 8 / 12 / 16 / 24px`.
Card interiors use 16px (`p-4`), tightening to 12px for nested readout panels.
Section gaps are 12–16px; the gap between major regions is 24px.

The header is a fixed region carrying identity, notifications, profile, and
the two stat tiles; the inventory list scrolls beneath it. A bottom
navigation bar is pinned, so all scrollable content reserves 128px of bottom
padding (`pb-32`) to clear it.

Responsive behaviour is narrow: stat tiles go one column below `sm` and two
above; action rows stack vertically on mobile and inline on `sm`. There is no
tablet or desktop layout, by design.

## Elevation & Depth

This system is **neumorphic**: depth comes from a paired light and dark shadow
simulating a single light source at the top-left, never from tinted fills or a
generic drop shadow. Every surface is the same colour as the page behind it,
so the only thing distinguishing a card from the background is how the light
catches its edge.

Shadow tokens are CSS variables (`--neu-shadow-dark`, `--neu-shadow-light`,
`--neu-dist`, `--neu-blur`) rather than fixed values, so a scope can re-tint
the light for a different backdrop — the sign-in screen does exactly this.

### Shadow Vocabulary
- **Raised** (`6px 6px 14px var(--neu-shadow-dark), -6px -6px 14px var(--neu-shadow-light)`):
  The default resting state for cards, tiles, and panels.
- **Raised Small** (`3px 3px 7px / -3px -3px 7px`): Compact controls where the
  full distance would look inflated — selectable option tiles, small badges.
- **Inset** (`inset 4px 4px 9px / inset -4px -4px 9px`): Anything the user
  types into or has selected. Inputs are always inset; a selected choice is
  inset while its unselected siblings are raised.
- **Lifted** (`8px 8px 18px / -8px -8px 18px` plus `translateY(-2px)`):
  Hover only.
- **Pressed** (the Inset value plus `translateY(0)`): Active/click only.

### Named Rules

**The Single Light Rule.** Light comes from the top-left, always. Every raised
surface is dark-shadowed bottom-right and light-shadowed top-left. A shadow
pair in any other direction breaks the whole panel's illusion, not just its
own element.

**The Press Rule.** Interactive surfaces must complete the physical loop:
raised at rest → lifted on hover → inset on press. A soft-UI control that
doesn't depress on click reads as a picture of a button rather than a button.

**The Matching Ground Rule.** Before applying any `neu-` class, confirm the
element's parent background equals `--neu-surface`. On a different ground,
override the scope's tokens (as `.neu-scope-navy` does) rather than accepting
grey-on-colour mud.

## Shapes

Soft, generously rounded rectangles throughout — the geometry of moulded
plastic hardware rather than paper. Radius scales with the element's size so
the curvature reads as constant: 8px on chips and small buttons, 12px on
inputs and inner readout panels, 16px on cards and stat tiles, 24px on
dialogs and the sign-in panel, fully rounded on avatars, status pills, and
icon buttons.

Borders are used sparingly and only inside a surface — the hairline around a
nested readout panel, or a coloured 20%-alpha border on a status chip. A
surface's *outer* edge is never drawn with a border; that edge is defined by
its shadow pair. Icon buttons are perfect circles; status badges are full
pills.

## Components

### Buttons
- **Shape:** Softly rounded (8px); icon-only buttons are circular (9999px).
- **Primary:** Ink fill with instrument-body text (`#111111` on `#e9ebf1`,
  inverting in dark), 10px×20px padding, Label typography. Used once per
  region for the single most likely action.
- **Pressable (soft-UI):** Same colour as its ground, defined entirely by the
  Raised shadow pair. The default for tiles, the bell, and profile controls.
- **Hover / Focus:** Pressable buttons lift 2px into the Lifted shadow over
  240ms `cubic-bezier(0.4, 0, 0.2, 1)`; filled buttons scale to 1.04 and
  return to 0.96 on tap.
- **Ghost:** Transparent with a 30%-alpha border of the surrounding text
  colour; used for the secondary action beside a primary one.
- **Destructive:** Reading Danger fill, reserved for delete.

### Chips
- **Style:** 10%-alpha wash of a readout colour, 20%-alpha border of the same
  colour, text in the solid colour, 8px radius, Label typography.
- **State:** Status chips are read-only measurements ("CRITICAL", "Matches
  Diet", "Allergens Unknown"). Filter chips invert instead: selected is
  inset, unselected is raised-small.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Instrument Body — identical to the page.
- **Shadow Strategy:** Raised at rest, Lifted on hover, Pressed on click.
- **Border:** None on the outer edge. Nested readout panels inside a card use
  a hairline border plus 12px radius to sit *within* the material.
- **Internal Padding:** 16px, tightening to 12px for nested panels.
- **Entry:** Spring in (stiffness 300, damping 26) from 16px below at 0.98
  scale; exit reverses.

### Inputs / Fields
- **Style:** Always Inset — a field is a groove in the panel, never a raised
  block. 12px radius, 14px×16px padding, Body typography.
- **Focus:** A 2px accent ring at low alpha plus a border shift, over 300ms.
  The inset shadow never changes; the field does not "pop out" when focused.
- **Error:** Danger text on a 10%-alpha danger wash inside a 20%-alpha border,
  animated in with a short horizontal shake.

### Navigation
- **Bottom bar:** Pinned, four destinations (Barcode, Home, Receipt, Ask AI),
  icon above a Label-sized caption. The active destination is Ink; the rest
  sit at reduced opacity.
- **Header:** Identity left, notification bell and profile right. The bell
  carries a Danger pill badge and rings periodically while items are critical.

### Signature Component — the Item Card

The system's most characteristic object and the pattern to imitate when
building anything new. A raised card containing a category icon, a health
grade square, the item name, and a status chip; beneath it, a nested inset
readout panel pairing an oversized Display-weight day count with a freshness
bar; beneath that, a row of measurement chips (diet match, allergen state).
It demonstrates every rule at once: one material, shadow-only hierarchy,
colour confined to the readout, and an oversized numeral as the primary
reading.

## Do's and Don'ts

### Do:
- **Do** keep `--background`, `--card` and `--neu-surface` identical. Changing
  one without the others is the single fastest way to break this system.
- **Do** complete the physical loop on every interactive surface: raised →
  lifted on hover → inset on press.
- **Do** put uppercase labels at 600 weight with 0.1em tracking, never less.
- **Do** show `unknown` rather than a reassuring default when data is missing —
  the "Allergens Unknown" chip is the reference implementation.
- **Do** re-tint `--neu-shadow-dark` / `--neu-shadow-light` when placing
  neumorphic surfaces on a non-standard ground, as `.neu-scope-navy` does.
- **Do** cap layouts at `max-w-md` and design for one hand.
- **Do** disable looping motion under `prefers-reduced-motion` while keeping
  the static depth, which is styling rather than movement.

### Don't:
- **Don't** introduce a decorative accent colour. If it isn't reporting a
  reading, it doesn't get colour.
- **Don't** put a border on the outer edge of a raised surface — the shadow
  pair is that edge.
- **Don't** use a generic single drop shadow (`0 4px 12px rgba(0,0,0,.1)`) on
  a surface that sits on the instrument body. It reads as a foreign object.
  The legacy `.sleek-shadow` helper predates this system; prefer `neu-raised`.
- **Don't** light anything from a direction other than top-left.
- **Don't** build a full-bleed opaque panel as a dialog. Dialogs are centred
  24px-radius cards over a dimmed, blurred backdrop; a full-screen takeover
  reads as the page breaking.
- **Don't** animate `width`, `height`, `top` or `left`. Transform and opacity
  only.
- **Don't** add a tablet or desktop layout without an explicit decision — the
  fixed phone frame is intentional.

## Known Drift

Recorded deliberately, to be reconciled rather than imitated.

- **The sign-in screen is off-system.** It uses a dark navy ground
  (`#050A16`) with cyan and indigo accents, drifting gradient blobs, and a
  gradient wordmark — none of which exist anywhere else in the app. The
  neutral instrument body plus readout-only colour is authoritative; the
  entry screen should be brought in line in a later pass. Until then, treat
  `.neu-scope-navy` as a bounded exception, not a licence for accent colour
  elsewhere.
- **`.sleek-shadow`** is a pre-neumorphism helper still present in
  `globals.css`. Superseded by the shadow vocabulary above.
