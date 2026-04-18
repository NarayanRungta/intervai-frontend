# Intervai Design System & UI Reference

This document serves as a reference for the visual language, typography, and UI patterns established in the Intervai platform.

## 1. Theme Overview
The Intervai theme is defined by a **formal, dark-blue, and "cyber-editorial" aesthetic**. It emphasizes deep spatial contrast, atmospheric lighting (glows), crisp typography, and high-fidelity interactive elements (glassmorphism, metallic shines).

## 2. Typography
The platform utilizes a dual-font system installed via `next/font/google`:
*   **Headings (`--font-league-spartan`)**: Used for strong, structural declarations. Often styled with `uppercase`, `font-black`, and very tight line-heights (`leading-tight` or `leading-[0.9]`) to feel authoritative.
*   **Body (`--font-manrope`)**: Clean, highly readable geometric sans-serif for paragraphs, descriptions, and UI labels. 

**Typographic Patterns:**
*   **Eyebrows / Overlines**: Used to introduce sections. Exceptionally small, heavily tracked out.
    *   *Classes*: `text-[11px] font-bold tracking-[0.3em] uppercase text-cyan-300/80` (or slate variants).
*   **Primary Headers**: `text-3xl text-white uppercase tracking-widest` for structured access forms or hero titles.
*   **Secondary Text**: `text-sm text-slate-400` leading to smooth contrast against the dark background.

## 3. Core Colors & Layers
The raw theme tokens are based on the OKLCH color space (see `globals.css`), leaning heavily into the `240-255` hue mapping (deep blues).

*   **Background Layer**: Deep, near-black navy (`oklch(0.15 0.03 252)`).
*   **Action Highlights**: Cyan / Light Blue (`text-cyan-400`, `via-cyan-200/40`) used for glossy reflections and glowing SVGs.
*   **Surfaces (Glassmorphism)**: 
    *   Used for cards and panels: `bg-white/5` or `bg-black/30` coupled with heavy blurs `backdrop-blur-2xl`.
    *   Borders: Ultra-thin, low-opacity strokes to simulate glass edges (`border border-white/10` or `border-white/20`).

## 4. Visual Effects & Components

### Backgrounds
*   **`.auth-grid-bg`**: A subtle 1px line grid with a radial mask so it fades smoothly into the deep background.
*   **Ambient Glows**: Absolute positioned radial gradients with high blur (`blur-[100px]`) and `mix-blend-screen` to simulate scattered ambient light.

### Panels & Containers (`auth-panel`)
The main container aesthetic heavily relies on:
1.  **High border radius**: `rounded-[2.5rem]` or `rounded-3xl` for friendly, modern silhouettes.
2.  **Glossy Edge Reflection**: A 1px absolute div at the `top-0` with a horizontal gradient (`from-transparent via-cyan-200/40 to-transparent`) simulating a light catching the top edge of a glass pane.
3.  **Shadows**: Deep structural shadows (`shadow-2xl`).

### Interactive Elements (Buttons)
Buttons utilize complex micro-interactions rather than flat background color changes.
*   **The "Shine" Effect**: Using an inner skewed `<div>` with `bg-white/20` and `blur-[4px]`, passing from `-translateX(150%)` to `translateX(150%)` on `group-hover` over a `1000ms` duration.
*   **Hover Scaling**: Inner elements (like SVG icons) scale up slightly (`hover:scale-110`) while the button container itself might depress (`active:scale-[0.98]`).
*   **Dynamic Borders**: Standard state `border-white/20`, hover state brightens to `border-white/40` with an outer glowing shadow (`shadow-[0_0_20px_rgba(255,255,255,0.1)]`).

### Lines & Dividers
*   Instead of flat borders, dividers use gradients fading to transparent at the edges: `bg-gradient-to-r from-transparent to-white/10`.

## 5. Motion (.auth-fade-up)
Entrance animations are formal and smooth. Elements slide upward slightly while fading in.
*   *Animation*: `fade-up 0.65s cubic-bezier(0.2, 0.7, 0.2, 1) both;`
*   *Keyframes*: Moves from `translateY(22px) scale(0.985)` at `opacity: 0` to natural positioning at `opacity: 1`.
