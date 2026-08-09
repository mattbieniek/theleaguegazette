# Design System

> Repository-backed draft. Global tokens audited August 7, 2026 at `b12aff34`; component-level visual audit remains open.

## Foundations

The visual language combines newspaper/editorial typography with a restrained green, paper, and ink palette. Global tokens live in `src/styles/global.css`; components may add scoped rules for feature-specific layouts.

### Color tokens

| Group | Tokens |
| --- | --- |
| Paper and surfaces | `--color-paper`, `--color-paper-light`, `--color-surface`, `--color-surface-muted` |
| Ink | `--color-ink`, `--color-ink-soft`, `--color-ink-muted`, `--color-ink-faint` |
| Brand | `--color-green`, `--color-green-hover`, `--color-green-soft`, `--color-green-faint` |
| Utility | `--color-rule`, `--color-rule-dark`, `--color-positive`, `--color-negative` |

Use semantic tokens instead of introducing one-off colors. Team accents belong in `src/data/teams.ts` and should not replace the publication's core palette.

### Typography

- `--font-editorial`: Newsreader Variable with Iowan/Palatino/Georgia fallbacks for mastheads, headings, and narrative display text.
- `--font-interface`: Inter Variable with system fallbacks for controls and body copy.
- `--font-data`: IBM Plex Mono for labels, metadata, standings, and utility values.
- Type tokens range from `--text-xs` through `--text-5xl`; display headlines commonly use `clamp()` for responsive scale.

### Layout and shape

- `--page-gutter` controls responsive outer padding; `--page-width` is `1280px`; `--content-width` is `760px` for reading measure.
- `--space-1` through `--space-9` provide the spacing scale from `0.25rem` to `6rem`.
- `--radius-sm`, `--radius-md`, and `--radius-lg` define control, panel, and card rounding.
- `--shadow-card` is the shared low-contrast surface elevation.
- `site-shell`, `editorial-width`, `page-main`, `section-rule`, `surface-card`, `eyebrow`, and `sr-only` are the main global primitives.

## Brand assets and media

- League and team logos live under `public/logos/`.
- Editorial and social imagery lives under `public/images/`.
- Team names, slugs, accent colors, and logo references are defined in `src/data/teams.ts`.
- Article images need meaningful `image_alt` text before publication when an image is present.

## Responsive and interaction patterns

There is no single global breakpoint contract. Components use local media queries, commonly around `960px`, `900px`, `760px`, and `600px`, depending on the layout. Preserve readable line lengths, horizontal table scrolling where needed, and full-width controls on narrow screens.

Global interaction rules include a 150ms fast transition, a 220ms standard transition, visible `:focus-visible` outlines, sticky public navigation, and a reduced-motion override that disables smooth scrolling and nearly all transitions.

## Editorial application

Prefer the editorial font for hierarchy and voice, the interface font for utility, and the data font for compact factual surfaces. Use double rules, fine borders, generous whitespace, and restrained color to maintain the Gazette's publication identity. A new feature should feel like part of the same paper even when its data visualization or workflow is novel.

## Accessibility baseline

- Keep focus visible and keyboard operation intact.
- Use semantic headings, labeled controls, table captions, and live regions for async status messages.
- Provide alt text for editorial images and decorative labeling where appropriate.
- Respect `prefers-reduced-motion` and avoid using color as the only status signal.
- Verify contrast for new team colors and admin utility states.

## Verification gaps

- TODO: Produce a visual token inventory for component-scoped styles and intentional exceptions.
- TODO: Audit contrast, keyboard access, screen-reader output, image crops, and mobile layouts across representative routes.
- TODO: Define approved editorial image ratios, crop rules, and placeholder behavior.
- TODO: Confirm whether a light-only theme is an intentional product decision.
