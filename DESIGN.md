---
name: Astra Just — Cadastro de Advogado
description: Fintech-checkout registration flow for a legal-content subscription, not a marketing page
colors:
  paper: "#f7f6f3"
  surface: "#ffffff"
  border: "#e6e3dd"
  ink: "#22262b"
  ink-soft: "#666b72"
  ink-weak: "#6f7276"
  accent: "#4f46e5"
  accent-hover: "#4338ca"
  accent-weak: "#eeedfc"
  error: "#c23b3b"
  success: "#1f8a57"
typography:
  title:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 500
  caption:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 400
rounded:
  sm: "10px"
  md: "14px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "13px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    padding: "13px 20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "32px 28px"
---

# Design System: Astra Just — Cadastro de Advogado

## Overview

**Creative North Star: "The Fintech Ledger"**

Astra Just's registration page refuses the generic navy-and-gold "escritório de advocacia" marketing page. It reads instead as a real, safe financial transaction — closer to Asaas Checkout or a bank's account-opening flow than to a law-firm landing page. The design has no hero, no sales copy, no social proof: a single centered card, a 3-step progress indicator, and one field at a time. The transaction itself is the interface; there is nothing around it to sell the advogado on.

The palette is near-white paper with graphite-black ink and exactly one accent (indigo) carrying every instance of primary action, active state, and focus. IBM Plex Sans runs the whole page — no display face, no serif, no second family. Cards are soft-shadowed and generously rounded; the overall material is quiet, professional, and restrained rather than tactile or decorative. This is a register a criterious lawyer with zero patience for "vendedor genérico" language can trust in one glance.

**Key Characteristics:**
- Single accent color (indigo) for every primary/active/focus signal, never decorative
- One IBM Plex Sans family across every text role — weight and size carry hierarchy, not font choice
- Flat, near-white paper background; depth comes from one soft ambient card shadow, not layering
- Generous, consistent field spacing — one coherent question per screen region
- Step-by-step disclosure (3 steps) instead of a single long form or a scroll-driven sales page

## Colors

Deliberately restrained: neutrals carry the page, one indigo accent carries every action.

### Primary
- **Confident Indigo** (`#4f46e5`): the single accent. Used for the active/completed step bubble, checked radio/checkbox fill, focus rings, the calculated-price banner, and the primary button. Never used decoratively — every appearance signals "this is active" or "this is the action to take."
- **Indigo Hover** (`#4338ca`): primary button hover/active state only.
- **Indigo Weak** (`#eeedfc`): tint background for the active step bubble, the focus-ring halo, and the calculated-price banner. The accent's only "quiet" register.

### Neutral
- **Paper** (`#f7f6f3`): page background. Near-white, warm, not pure white — the "world" ground.
- **Surface** (`#ffffff`): the card and all input backgrounds, pure white against the warmer paper.
- **Border** (`#e6e3dd`): default border for inputs, dividers, progress line, card edges.
- **Ink** (`#22262b`): primary text, headings, labels.
- **Ink Soft** (`#666b72`): step legends, secondary-button text, helper copy under headings.
- **Ink Weak** (`#6f7276`): progress labels (inactive), placeholders — the quietest text role.
- **Error** (`#c23b3b`): field validation errors and the error state of the status message only.
- **Success** (`#1f8a57`): the success state of the status message only.

### Named Rules
**The One Accent Rule.** Indigo is the only color allowed to mean "active," "selected," or "primary action." It never appears as pure decoration; every indigo pixel is a state signal.

## Typography

**Body/Display/Label Font:** IBM Plex Sans (with `-apple-system, BlinkMacSystemFont, sans-serif` fallback)

**Character:** A single, professional sans-serif carries the entire page. Hierarchy comes from weight and size, not from a display/body pairing — this keeps the checkout register plain and legible rather than editorial.

### Hierarchy
- **Title** (400, 1.3rem, -0.01em letter-spacing): step `<h1>` headings ("Seus dados", "Endereço e áreas", "Pagamento").
- **Body** (400, 0.95rem): input text and general copy.
- **Label** (500, 0.85rem): field labels, fieldset legends.
- **Caption** (400, 0.78–0.92rem): step legends under headings, field-level error text, status messages.
- **Brand mark** (700, 1.05rem, -0.01em): the "Astra Just" wordmark at the top of the page — the one place bold weight is used for identity rather than emphasis.

### Named Rules
**The No-Display-Face Rule.** There is no separate display typeface. Every text role is IBM Plex Sans at a different weight/size; the system never reaches for a second family to signal importance.

## Layout

Single-column, single-card flow, centered at a narrow measure. `.pagina` caps at 480px and centers via `margin: 0 auto`, with 40px vertical / 16px horizontal page padding. The card (`.cartao`) holds 32px vertical / 28px horizontal internal padding at desktop, dropping to 24px/18px under 420px. Fields stack vertically with a consistent rhythm: labels sit 16px above their input (`margin-top`), paired fields (OAB número/UF, endereço número/CEP) sit in a 2-column grid with 12px gap that collapses to a single column under 420px. Only one step section is visible at a time (`[hidden]` on inactive `.passo` sections), each entering with a 0.25s fade/translateY-6px animation — the "one coherent thing at a time" story made literal in markup, not just in copy. Action buttons anchor bottom-right of the card (`justify-content: flex-end`) and stack full-width, reversed, on mobile.

## Elevation & Depth

Flat by default; the only depth cue is one soft ambient shadow under the card, which floats the transaction above the paper background. No shadows appear anywhere else — buttons, inputs, and chips are flat and use border/fill color changes for state instead of elevation.

### Shadow Vocabulary
- **Card ambient** (`box-shadow: 0 1px 2px rgba(20,20,15,0.04), 0 16px 40px -12px rgba(20,20,15,0.16)`): the one shadow token in the system. Used exclusively on `.cartao`.

### Named Rules
**The One Shadow Rule.** Exactly one shadow value exists in the system, reserved for the card that holds the transaction. Nothing else lifts.

## Shapes

Two radius steps, both soft and generous: a small radius (`10px`) for interactive controls (inputs, buttons, chips, the price banner, the Pix QR frame) and a larger radius (`14px`) for the containing card. Progress-step bubbles and checkbox/radio accents use a pill (`999px`). Borders are thin (`1.5px`) and low-contrast (`--cor-borda`), used for resting-state definition on inputs, the areas-list box, and payment-method rows rather than to separate content into visually heavy blocks.

## Components

### Buttons
- **Shape:** rounded rectangle (10px radius).
- **Primary:** solid indigo fill (`#4f46e5`), white text, 13px/20px padding, 600 weight, min-width 160px, anchored bottom-right of the active step.
- **Hover / Focus:** primary darkens to `#4338ca` on hover; a 0.05s scale-to-0.98 on `:active` gives tactile press feedback; disabled state drops opacity to 0.55 and removes the press transform.
- **Secondary:** transparent fill, soft-ink text, 1.5px border in the resting border color; hover darkens the border and text toward full ink. Used only for "Voltar" (back navigation), never for a second competing action.

### Cards / Containers
- **Corner Style:** 14px radius.
- **Background:** pure white surface against the warmer paper background.
- **Shadow Strategy:** the one ambient card shadow (see Elevation & Depth).
- **Border:** none — the shadow alone separates the card from the page.
- **Internal Padding:** 32px/28px desktop, 24px/18px under 420px.

### Inputs / Fields
- **Style:** white surface, 1.5px border in the resting border color, 10px radius, 11px/12px padding.
- **Focus:** border shifts to accent indigo plus a 3px indigo-weak halo (`box-shadow: 0 0 0 3px var(--cor-accent-fraco)`) — the same focus treatment used site-wide via `:focus-visible`, so keyboard and pointer focus read identically.
- **Error:** field-level error text appears below the input in `--cor-erro`, reserving a fixed `min-height` so layout doesn't jump when an error appears.
- **Checkbox/Radio:** native controls with `accent-color` set to indigo, used for LGPD consent, area-of-practice selection, and payment-method choice; selected payment-method rows additionally get an indigo border and indigo-weak fill via `:has(input:checked)`.

### Navigation (step progress)
- **Style:** a horizontal 3-dot stepper (numbered pill bubbles connected by thin lines) above the form, not a top nav bar. Inactive bubbles are white with a border-color outline and weak-ink number; the active bubble gets an indigo border, indigo-weak fill, and indigo number; completed bubbles fill solid indigo with white text, and the connecting line to their right also turns indigo. Step labels beneath each bubble are hidden under 420px, leaving just the numbered dots on mobile.

## Do's and Don'ts

### Do:
- **Do** use indigo (`#4f46e5`) as the only accent — for primary actions, active/completed step state, focus rings, checked inputs, and the calculated-price banner.
- **Do** keep every text role in IBM Plex Sans; differentiate hierarchy with weight and size, not typeface.
- **Do** reserve the card shadow for the one container holding the transaction; keep buttons, inputs, and chips flat.
- **Do** disclose one step's fields at a time behind the 3-dot progress indicator rather than a single long scroll.

### Don't:
- **Don't** introduce a second accent color or a decorative color role — the palette's discipline (one accent, warm neutrals) is load-bearing for the "not a sales pitch" thesis.
- **Don't** add hero imagery, testimonials, or sales copy above the form. The direction contract explicitly rejects social-proof framing (Product Principle 1: no fabricated testimonials pre-launch) and a marketing register for this page.
- **Don't** add a display/serif typeface or emissive/decorative visual registers (the concept-seed pass explicitly declined a retro-console/glitch/emissive-void direction as unreadable for this audience — see the surface brief FORM block).
