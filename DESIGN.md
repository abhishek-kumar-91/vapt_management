---
name: Pentest Scout
description: A calm, black-and-white VAPT console where the SOP close-out line is the one recurring visual idea.
colors:
  scout-ink: "oklch(0.205 0 0)"
  scout-ink-foreground: "oklch(0.985 0 0)"
  paper-ground: "oklch(0.982 0 0)"
  card-white: "oklch(1 0 0)"
  ink: "oklch(0.2 0 0)"
  muted-text: "oklch(0.5 0 0)"
  grey-wash: "oklch(0.955 0 0)"
  muted-wash: "oklch(0.962 0 0)"
  accent-wash: "oklch(0.95 0 0)"
  hairline: "oklch(0.915 0 0)"
  focus-grey: "oklch(0.55 0 0)"
  destructive-red: "oklch(0.57 0.22 25)"
  severity-critical: "oklch(0.57 0.21 25)"
  severity-high: "oklch(0.66 0.17 50)"
  severity-medium: "oklch(0.76 0.15 80)"
  severity-low: "oklch(0.6 0.13 250)"
  health-green: "oklch(0.58 0.13 160)"
  health-amber: "oklch(0.7 0.15 70)"
  health-paused: "oklch(0.56 0.15 295)"
  night-ground: "oklch(0.165 0 0)"
  night-card: "oklch(0.21 0 0)"
  night-ink: "oklch(0.96 0 0)"
typography:
  display:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  xl: "0.875rem"
  3xl: "1.375rem"
  4xl: "1.625rem"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.scout-ink}"
    textColor: "{colors.scout-ink-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.4xl}"
    padding: "0 12px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.grey-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.4xl}"
    padding: "0 12px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.paper-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.4xl}"
    padding: "0 12px"
    height: "36px"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.4xl}"
    padding: "0 12px"
    height: "36px"
  input:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.3xl}"
    padding: "4px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.4xl}"
    padding: "24px"
  badge-tone:
    typography: "{typography.label}"
    rounded: "{rounded.3xl}"
    padding: "2px 10px"
    height: "20px"
  nav-item:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
---

# Design System: Pentest Scout

## Overview

**Creative North Star: "The Close-out Line"**

Pentest Scout is a calm, product-grade security console built on shadcn Luma: pill controls, deeply rounded cards resting on a pure neutral ground, and soft ring-plus-shadow depth. The brand is black and white: Scout Ink carries action and progress; every other colour in the system is semantic and only ever means severity or health. The density is that of a working tool: small, legible body text, tabular numerals for every count, and a work queue rather than a poster on the first screen.

The one recurring idea is the SOP close-out line. The close-out meter (a segmented pill with a tick at 80%) appears in the portfolio summary, the product table and the product header, and the motion grammar reinforces it: data marks draw in left to right, as if being filled toward that line. Content settles in rather than performing.

The system explicitly refuses the category default it was built against: a dark navy sidebar, four identical KPI tiles and 9px grey text.

**Key Characteristics:**
- No brand hue: Scout Ink (black in light mode, near-white in dark) is the brand; severity and health colours carry meaning only.
- Status is always colour plus a word or letter, never colour alone.
- Pill-shaped controls, 1.625rem-radius cards, inset rounded app canvas beside a light sidebar.
- Figtree throughout with tabular numerals; Geist Mono only for ticket IDs and report text.
- Motion: data reveals left to right, content settles in; all of it collapses under reduced motion.
- Light and dark themes are both first-class, defined token for token.

## Colors

A near-white, untinted neutral field with black ink as the only brand colour and a disciplined semantic set.

### Primary
- **Scout Ink** (scout-ink): primary buttons, the Tested segment of the close-out meter, active product links, chart series 1, selection tint (22% mix). In dark mode it inverts to Night Ink (night-ink), near-white.

### Neutral
- **Paper Ground** (paper-ground): page and sidebar ground; also the theme-color `#fafafa`.
- **Card White** (card-white): cards and popovers, lifted off the ground by ring and shadow.
- **Ink** (ink): body and heading text.
- **Slate Muted Text** (slate-muted-text): descriptions, metadata lines, legends. Used at 12px or larger.
- **Grey Wash / Muted Wash / Accent Wash** (grey-wash, muted-wash, accent-wash): secondary buttons, empty meter track, hover and active nav fills.
- **Hairline** (hairline): borders and dividers; dark mode switches to white at 9%.
- **Night Ground / Night Card** (night-ground, night-card): dark theme ground (`#161616` theme-color) and card surface, untinted.

### Semantic: severity and health
- **Critical** (severity-critical), **High** (severity-high), **Medium** (severity-medium), **Low** (severity-low): finding severity only. Also the Blocked meter segment (critical at 70%).
- **Green** (health-green), **Amber** (health-amber), **Red** (severity-critical), **Paused** (health-paused), **Not started** (muted wash): product health and finding-status tones. Health Green also turns the close-out tick green once coverage passes 80%.
- **Destructive Red** (destructive-red): destructive actions and invalid fields, rendered as a tinted wash with red text, never a solid red slab.

### Named Rules
**The Ink Rule.** Black and white are the brand; ink is the only colour that may mean "brand" or "go". Red, orange, amber, blue, green and violet appear only when they mean severity or health.

**The Colour Plus Word Rule.** Every semantic colour is paired with text: tone badges carry the word, severity counts carry a visible letter (C/H/M/L), health dots sit beside their label.

**The Tinted Badge Rule.** Tone badges are a 12-20% tint of the semantic colour with text darkened by a `color-mix` toward black (light mode) or the raw tone (dark mode), so every tone clears 4.5:1.

## Typography

**Display Font:** Figtree (with ui-sans-serif, system-ui)
**Body Font:** Figtree
**Label/Mono Font:** Geist Mono (with ui-monospace), for ticket IDs (`SEC-121`), method fields and generated report text only.

**Character:** One friendly geometric sans at modest weights does all the speaking; hierarchy comes from size and weight steps, not from a second display face. Mono is a data signal, not a style.

### Hierarchy
- **Display** (600, 1.875rem, tight tracking, tabular): headline metrics such as portfolio coverage percentage.
- **Headline** (600, 1.5rem, tight tracking): page titles in the page header; product coverage figure.
- **Title** (500-600, 1rem): card titles and section headings.
- **Body** (400, 0.875rem): rows, descriptions, form text. Inputs render at 1rem below md, 0.875rem above.
- **Label** (500, 0.75rem): badges, legends, metadata, stat captions. This is the floor for running text.
- **Mono** (400, 0.75rem): ticket IDs inline in metadata lines; report previews with relaxed leading.

### Named Rules
**The Tabular Rule.** Every number that can change or be compared (counts, percentages, dates in data) uses tabular numerals.

**The 12px Floor Rule.** Readable text never drops below 0.75rem. Headings balance their wrap.

## Layout

An inset-sidebar app shell: a 17.5rem light sidebar on the ground, and the content canvas as a rounded (1.375rem) inset panel with ring and soft shadow at md and up. Below md the sidebar becomes an off-canvas sheet and the canvas goes full-bleed. The sidebar collapses to an icon rail on desktop.

Content is centred at max 80rem with 16px side padding (32px at md) and 24px top padding (32px at md). Page structure stacks on a 24px gap: page header (title, description, actions aligned to the bottom edge), a wide summary card, then two-up cards at lg. Inside cards, spacing is 24px (16px for the small card size); row clusters use 8px and 16px gaps.

## Elevation & Depth

Depth is a hybrid of a hairline ring and a soft ambient shadow. Cards and the inset canvas sit on the ground with a 1px ring of the foreground at 5% (10% in dark) plus a medium diffuse shadow. Nothing else is lifted at rest except small date tiles (extra-small shadow) and overlays. Focus is a 3px ring of the focus grey at 30%.

### Shadow Vocabulary
- **Card lift** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` with a 1px foreground/5% ring): cards and the inset content canvas.
- **Tile lift** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): small round date tiles in cycle lists.
- **Focus ring** (`box-shadow: 0 0 0 3px` focus-grey at 30%): every interactive control and the meter.

### Named Rules
**The Ring-First Rule.** A surface is defined by its hairline ring before its shadow; shadows stay soft and ambient, never hard or offset.

## Shapes

Fully rounded. Buttons, inputs, badges, meters, avatars and status dots are pills or circles. Cards use a 1.625rem radius; the inset canvas, report preview blocks and inputs 1.375rem; sidebar menu items 0.875rem. Data bars (meter, severity bars) clip with fully rounded ends; segments are separated by a 1px gap rather than borders.

## Components

### Buttons
Soft, pill-shaped and quiet; one primary per view.
- **Shape:** pill (1.625rem radius on a 36px height; 24/32/40px sizes).
- **Primary:** Scout Ink fill, near-white text (inverted in dark mode), 14px medium; hover drops to 80% opacity.
- **Hover / Focus:** 3px grey focus ring at 30%; pressed buttons nudge down 1px.
- **Secondary / Outline / Ghost:** grey wash fill; ground fill with hairline border; transparent with muted-wash hover.
- **Destructive:** red tint wash with red text.

### Chips (tone badges)
- **Style:** 20px pill, 12px medium text, tinted semantic background, darkened semantic text; health badges add a leading current-colour dot.
- **State:** static status display; finding statuses map Triaged to ink, In Fix to amber, Ready for Retest to violet, Closed to green, exit states to neutral.

### Cards / Containers
- **Corner Style:** 1.625rem.
- **Background:** card white (night card in dark).
- **Shadow Strategy:** Card lift (see Elevation).
- **Border:** 1px foreground ring at 5%.
- **Internal Padding:** 24px (16px small).

### Inputs / Fields
- **Style:** borderless pill (1.375rem radius, 36px) on the input colour at 50%.
- **Focus:** ring-coloured border plus 3px ring at 30%.
- **Error / Disabled:** destructive border and 20% destructive ring; disabled at 50% opacity.

### Navigation
- **Sidebar:** brand mark and name, then nav items (14px, 0.875rem radius, accent-wash fill and medium weight when active) with an open-finding count; a product list with avatars and health dot plus label; a sample-data note card at the foot.
- **Header:** sidebar toggle, breadcrumb, theme toggle and account menu.
- **Mobile:** sidebar becomes an off-canvas sheet.

### Close-out Meter (signature)
A segmented pill (6/8/12px heights) on the muted track: Tested in ink, In testing in ink at 35%, Blocked in critical at 70%, To do as the empty track, segments split by 1px gaps. A 2px tick, ringed in card colour, stands at the 80% close-out line: muted ink below the line, Health Green once coverage passes. It is an accessible `meter` with a full text label and a tooltip of counts, and always ships with its legend where first introduced.

### Motion
- **Data reveal:** meters and severity bars draw left to right via clip-path inset over 900ms; the trend chart over 1100ms after a 120ms delay. Easing `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Content settle:** route content and tab panels rise 6px and fade in over 320ms with the same easing.
- **Collapsibles:** area rows animate height open and closed.
- **Appearance switch:** Settings → Appearance offers Default and Dark sidebar (dark navigation frame on `--sidebar-contrast`, light content inset; the sidebar subtree takes the full `.dark` token set). Persisted in the `pentest_scout_appearance` cookie and rendered on the server; switching cross-fades over 320ms.
- **Theme switch:** the new theme is revealed by a circle growing from the toggle button (View Transitions, 560ms, same expo ease; `lib/theme-transition.ts`). The `D` hotkey uses the same reveal. Instant switch without View Transitions support or under reduced motion.
- **Sign-in brand panel:** the keyring mark, drawn large in white on ink as a dial with tick ring and faint scope circles. The open ring draws in once (1400ms), then scans slowly (one turn per ~2.5 min); while the pointer is over the panel it turns its opening toward the pointer and the keyhole leans a little the same way, both eased per frame. A 260px lens brightens the dot field under the pointer. No product data on this screen: the platform is generic. Static under reduced motion.
- **Route loading:** no top progress bar. A centred brand loader (`components/brand-loader.tsx`): the keyhole holds still while the ring sweeps round it (1.6s, arc grows 8%→74% and back as it orbits) and a scope pulse spreads outward. It appears only after 180ms so fast navigations never flash. `app/dashboard/loading.tsx` shows it inside the content canvas (sidebar and header stay); `app/loading.tsx` shows it full screen with the wordmark (e.g. signing in). Reduced motion swaps in the static mark.
- **Reduced motion:** every animation and transition collapses to 1ms.

## Do's and Don'ts

### Do:
- **Do** use the close-out meter wherever coverage is shown; keep the tick at the SOP's 80% line.
- **Do** pair every severity and health colour with a word or letter.
- **Do** use tabular numerals for every metric and count.
- **Do** keep one ink primary button per view, pill-shaped.
- **Do** label sample data wherever data appears.
- **Do** reveal data marks left to right and settle content in with the 6px/320ms rise; nothing else moves.

### Don't:
- **Don't** use a dark navy sidebar; the sidebar shares the light paper ground.
- **Don't** build rows of identical KPI tiles; summary stats live in one wide card beside the meter.
- **Don't** set readable text below 0.75rem.
- **Don't** introduce a brand hue or use semantic colours decoratively.
- **Don't** use hard or offset shadows; depth is ring plus soft ambient shadow.
- **Don't** use Geist Mono beyond ticket IDs, method fields and report text.
