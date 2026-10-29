# Liba OS design direction

Operate mode: a daily insurance desk. The references are Linear, Vercel, Stripe, Raycast, Arc, visionOS, Framer, Attio, and Height. Liba does not average them. The dominant direction is Linear’s quiet operational chrome, with visionOS used only for the material of floating surfaces. Stripe’s restraint keeps numbers readable. Raycast keeps the command palette instant.

## Principles

1. One job per surface. The page holds the work. Glass is only for things that float: bar, dock, palette, dialog, the KPI band.
2. Gold is Liba’s only saturated brand color. Shemesh replaces that role with its blue. Status colors stay success, warning, info, and destructive, and they never decorate.
3. Numbers do not move except for a single count-up on first paint, and only when motion is allowed. The last frame is the real formatted value.
4. Motion is ease-out, short, and skipped when it would be seen all day. The command palette does not animate.
5. If backdrop-filter is missing, the surface becomes an opaque card. Text contrast does not depend on the blur.

## Glass

- Fill: card at 84% in light, 78% in dark. A 1px border at border color, plus a 1px inner highlight (white 70% light, white 8% dark).
- Blur: 18px, saturation 1.25. No animated grain. A static noise overlay at 4% opacity.
- Shadow: the existing lift token. No heavy black drop shadows.
- Fallback: `@supports not (backdrop-filter: blur(1px))` sets the fill to solid card.

## Ambient mesh

A fixed, non-interactive wash behind the shell: a gold radial for Liba, the Shemesh highlight blue inside `.shemesh-os`. Opacity stays under 0.2. It does not animate. Reduced motion does not need to remove it because it never moves.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Entrances, presses |
| `--ease-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Rare brand entrance |
| `--dur-rise` | 420ms | Page enter, login |
| `--dur-chart` | 900ms | Chart and spark draw |
| Press | `scale(0.97)` on `:active` | Buttons |
| Palette | none | Keyboard-scale tool |

Page changes remount `.enter`. `prefers-reduced-motion: reduce` sets those animations to none.

## Color

Light paper `40 23% 96%`, ink text, white cards. Brand gold `#FFD400` is highlight, not body text. Dark ink canvas, gold primary so buttons stay visible. Shemesh `.shemesh-os` keeps blue highlight; in dark mode its primary is that blue.

Contrast target is WCAG AA for text on card and on glass. Gold is a fill behind ink text, never the text color on white.

## Type

Rubik, `font-synthesis: none`.

| Role | Size | Weight |
| --- | --- | --- |
| Kicker | 11px | 600, tracking 0.16em |
| Body | 14px | 400–500 |
| Section | 16px | 600 |
| Page title | 24–30px | 600, tight tracking |
| KPI | 30–36px | 600, tabular nums |

Hebrew headings use a slightly looser line-height than Latin display type so nikud and accents do not collide.
