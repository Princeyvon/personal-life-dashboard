# Design System: Personal Life Dashboard

## Visual theme and atmosphere

The dashboard keeps its existing editorial workspace direction: a warm paper canvas, quiet surfaces, a charcoal navigation rail, and a restrained mint signal color. The atmosphere is calm and focused rather than decorative. Density is balanced for daily use, variance is moderate through the existing asymmetric shell and card rhythm, and motion is fluid but restrained so planning and reflection remain the focus.

## Color palette and roles

| Token | Value | Role |
| --- | --- | --- |
| Paper canvas | `#F0F1EE` | App background and mobile safe-area field |
| Warm surface | `#FFFEFA` | Main workspace and cards |
| Charcoal ink | `#11120F` | Primary text, navigation rail, primary actions |
| Ink soft | `#5F625D` | Body copy, helper text, secondary labels |
| Accessible faint | `#687168` | Metadata that must remain readable on light surfaces |
| Mint signal | `#B9EAD8` | Active states, positive status, primary dashboard accent |
| Mint deep | `#2F745C` | Accent text, chart marks, success feedback |
| Coral alert | `#F17E6C` | Caution and attention without neon saturation |
| Structural line | `rgba(17,18,15,0.09)` | Quiet dividers and card boundaries |
| Strong focus | `#2F7D61` | Keyboard focus ring and high-contrast interaction cue |

The system uses one restrained accent family and never relies on color alone to communicate state. Text and surface pairs are chosen for readable contrast, with an additional `prefers-contrast: more` mode that strengthens borders and metadata.

## Typography rules

The dashboard uses a sans-serif stack with character: `Geist Sans`, `Satoshi`, `SF Pro Display`, and a system sans fallback. Headings are track-tight and compact, while body copy uses relaxed leading. Dates, amounts, scores, and other dense values use tabular numerals. No headline or navigation label should force horizontal overflow on a narrow viewport.

## Component styling

Cards keep the existing warm surface, soft diffuse depth, and generous but controlled radius. Primary actions use charcoal ink with white text or mint with charcoal text. Secondary controls stay quiet and tactile. Inputs have at least a `2.75rem` touch height, visible focus rings, readable placeholder text, and `16px` mobile text sizing to prevent iOS zoom. Loading, empty, error, and unavailable states retain their current honest copy and should remain inline and actionable.

## Layout and responsive principles

The desktop information architecture is preserved: floating rail, scrollable workspace, top context bar, tabs, dashboard sections, and mobile dock. Below `768px`, the rail is hidden, the workspace becomes a single column, tabs remain horizontally browseable without creating page-level overflow, tables retain local scroll, dialogs stay within the dynamic viewport, and the dock respects both top-level spacing and the device safe-area inset. Below `360px`, header actions and voice controls tighten without allowing text or buttons to escape the viewport.

Every major container has `min-width: 0`; long labels wrap safely; grid children can shrink; and `overflow-x` is clipped at the page boundary. Touch targets remain at least `44px` wherever practical. Full-height behavior uses `100dvh`-aware sizing, and scrolling is contained to the dashboard workspace on desktop.

## Motion and accessibility

Interactions respond on press with a subtle scale cue and use the existing custom easing curve. Motion stays on transform and opacity, and `prefers-reduced-motion: reduce` removes non-essential movement while preserving feedback. `prefers-contrast: more` increases structural definition and metadata contrast. Focus-visible rings are present on actions, links, tabs, and form controls.

## Anti-patterns

Do not replace the existing workflows with a generic marketing layout, do not introduce horizontal page scrolling, do not use low-contrast gray metadata, do not hide form labels behind floating placeholders, do not make buttons smaller than touch-safe sizing, and do not use motion that blocks input or causes layout reflow. Keep the dashboard’s existing content and navigation vocabulary intact.
