---
name: Clinical Excellence System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#5d3f3c'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#926e6b'
  outline-variant: '#e7bdb8'
  surface-tint: '#c00015'
  primary: '#b90014'
  on-primary: '#ffffff'
  primary-container: '#e31b23'
  on-primary-container: '#fff9f8'
  inverse-primary: '#ffb4ac'
  secondary: '#515f74'
  on-secondary: '#ffffff'
  secondary-container: '#d5e3fd'
  on-secondary-container: '#57657b'
  tertiary: '#585c5d'
  on-tertiary: '#ffffff'
  tertiary-container: '#717476'
  on-tertiary-container: '#f9fbfd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ac'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#93000d'
  secondary-fixed: '#d5e3fd'
  secondary-fixed-dim: '#b9c7e0'
  on-secondary-fixed: '#0d1c2f'
  on-secondary-fixed-variant: '#3a485c'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max-width: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  section-gap: 80px
---

## Brand & Style

The design system is engineered for high-stakes medical education, specifically targeting cardiology professionals and students. The brand personality is **authoritative, precise, and sophisticated**, evoking the meticulous nature of clinical practice. 

The aesthetic follows a **Modern Minimalist** philosophy with a focus on information density and cognitive ease. By utilizing expansive whitespace and a structured grid, the system reduces "clinical noise," allowing the user to focus on complex medical data and diagnostic visuals. The visual language balances the warmth of high-end education with the cold precision of medical technology.

Key principles:
- **Academic Rigor:** Every element must feel intentional and grounded in peer-reviewed quality.
- **Clarity over Decoration:** Visual flourishes are minimized unless they serve a functional purpose in data visualization.
- **Institutional Trust:** The interface should feel like a premium digital textbook or a modern hospital workstation.

## Colors

The palette is anchored by **Deep Medical Red**, used strategically for primary actions, critical anatomical markers, and branding accents. This bold red provides immediate visual hierarchy against a sterile, clinical background.

- **Primary Red (#E31B23):** Reserved for high-priority CTAs, error states, and highlighting key clinical findings (e.g., "Critical Stenosis").
- **Slate Grays (#334155, #64748B):** Used for typography and secondary UI elements to ensure high legibility without the harshness of pure black.
- **Clinical Whites & Off-whites:** The foundation of the UI. Backgrounds use pure white for content areas and very light gray for container grouping to provide subtle separation.
- **Functional Accents:** Success (Emerald) and Warning (Amber) tones should be desaturated to maintain the professional, academic tone.

## Typography

The design system utilizes **Inter** for its exceptional legibility in data-heavy environments. The typeface's tall x-height and neutral character make it ideal for reading long-form clinical papers and viewing EKG annotations.

- **Headlines:** Use semi-bold weights with slight negative letter-spacing to create a "compact" and authoritative editorial feel.
- **Body Text:** Optimized for long-form reading with a generous 1.5x line height.
- **Labels:** Small caps and increased tracking are used for metadata, such as "Patient ID" or "Journal Reference," to distinguish them from actionable content.
- **Precision:** Numerical data (vitals, measurements) should utilize Inter’s tabular lining features to ensure vertical alignment in tables.

## Layout & Spacing

The layout philosophy centers on a **Fixed Grid** for desktop to ensure medical diagrams and EKG strips maintain their diagnostic integrity. 

- **Desktop:** A 12-column grid with a 1280px max-width. Large 80px gaps between major sections prevent cognitive overload.
- **Mobile:** A 4-column fluid layout. Margins are reduced to 16px to maximize the "reading surface" for mobile learning.
- **Rhythm:** An 8px base unit governs all padding and margins. Use "Breathable Density"—tight spacing (8-16px) for related data points within a card, but generous spacing (24-40px) between distinct content modules.
- **Clinical Sidebars:** Use a fixed left-rail for navigation and an optional right-rail for "Quick Reference" medical stats or search filters.

## Elevation & Depth

This design system uses a **Tonal Layering** approach supplemented by **Ambient Shadows**. The goal is to create a hierarchy that feels physical, like a series of papers or slides on a desk.

- **Level 0 (Background):** Slate-50 (#F8FAFC). Used for the base canvas.
- **Level 1 (Cards/Content):** Pure White (#FFFFFF). Uses a very soft, diffused shadow (0px 4px 20px rgba(0, 0, 0, 0.04)) to lift it slightly from the background.
- **Level 2 (Modals/Overlays):** Pure White. Uses a more pronounced shadow (0px 10px 32px rgba(0, 0, 0, 0.08)) to indicate temporary interaction.
- **Interaction:** No shadows on buttons; use color shifts (hover) and inset shadows (active) to maintain a flat, professional profile.

## Shapes

The shape language is **Soft (0.25rem)**. This subtle rounding removes the clinical "harshness" of sharp corners while maintaining a professional, structured appearance.

- **Standard Elements:** Inputs, buttons, and small tags use a 4px (0.25rem) radius.
- **Large Containers:** Modules and cards use 8px (0.5rem) to feel more approachable.
- **Iconography:** Icons should use a consistent 2px stroke weight and slightly rounded terminals to match the UI's geometry.
- **Data Visualizations:** Charts and EKG borders should remain sharp (0px) to signify scientific precision.

## Components

- **Primary Buttons:** Solid Medical Red background, white text. No gradients. Hover state is a 10% darken of the primary red.
- **Clinical Cards:** White background, 1px border (#E2E8F0), and a Level 1 shadow. Header sections within cards should have a subtle gray background.
- **Input Fields:** Minimalist design. A bottom-only border or a light 4-sided stroke that thickens and turns Red on focus. 
- **Instructional Chips:** Used for "Case Study," "Video," or "Quiz" tags. Use a light slate background with deep slate text for a neutral, non-distracting look.
- **Progress Indicators:** Linear bars in Medical Red, used for tracking lesson completion or patient vitals.
- **Reference Lists:** Use a 1px divider between items. Typography should be `body-md` with slate gray for descriptions.
- **EKG Viewer:** A specialized component with a dark slate background, high-contrast grid lines, and a vibrant primary red or electric green waveform.