# Shmoukh Care redesign audit

Design read: overhaul redesign of a premium hair-care landing page for beauty buyers, with an editorial luxury and soft structuralist language, using the existing static HTML/CSS/JS stack.

Dials: `DESIGN_VARIANCE: 7`, `MOTION_INTENSITY: 8`, `VISUAL_DENSITY: 3`.

## Current design violations found

1. The hero was cluttered with price messaging, badges, secondary CTAs, and side content, which diluted the single conversion moment.
2. The page leaned on repeated centered section headers, producing a predictable template rhythm instead of a premium editorial hierarchy.
3. Product cards appeared as a conventional equal grid, making the core products feel interchangeable rather than curated.
4. Typography relied on a generic Arabic sans treatment with limited contrast between display, body, navigation, and CTA text.
5. The color system mixed flat dark panels, cream sections, and generic borders without a disciplined premium palette.
6. Whitespace was inconsistent, with dense copy blocks and compressed product sections competing for attention.
7. Images were present but treated as content thumbnails rather than the main luxury brand signal.
8. Motion was mostly basic reveal behavior, with little scroll choreography, parallax, or tactile interaction.
9. Buttons had ordinary hover states and lacked the nested, weighty feel expected from a premium landing page.
10. Trust cues were present but scattered into clutter rather than composed as a dedicated confidence section.
11. Inline style fragments made the visual system harder to maintain and broke design consistency.
12. Several sections reused the same card and grid language, reducing perceived craft and making the page feel assembled.
13. The order section mixed too many contact paths at the conversion point, making the primary action less decisive.
14. Mobile conversion existed, but the surrounding hierarchy still depended on dense desktop-era blocks.

## Fixes applied

1. Rebuilt the public landing page around a minimal hero with the requested headline and one `Order Bundle` CTA.
2. Replaced the visual language with a unified olive, cream, deep brown, and gold luxury palette.
3. Added a premium serif display stack and restrained sans body stack without external font dependencies.
4. Used existing product and packaging assets as primary brand visuals, including the packaging image in the hero.
5. Reworked products into an asymmetric editorial layout with one feature product and two supporting products.
6. Added a separate confidence row for price, cash on delivery, and returns outside the hero.
7. Rebuilt the care routine as a spacious ritual section with a large product visual and guided steps.
8. Reframed customer feedback into a visual proof gallery with restrained supporting copy.
9. Simplified the order close into one clear conversion panel and reused the same CTA label consistently.
10. Added GSAP scroll choreography for hero parallax and product movement, with reduced-motion safeguards.
11. Added IntersectionObserver reveal states without using scroll event listeners.
12. Preserved key anchors, legal links, WhatsApp route, social links, and product/order/FAQ SEO structure.
