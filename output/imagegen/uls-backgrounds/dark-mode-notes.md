# Dark-mode campus backgrounds

Generated with the built-in image generation tool; each matching light image was its edit target.

## Prompt used for all three

Use case: lighting-weather. Edit the provided campus background into its matching DARK MODE nighttime variant for a web app. Keep EXACTLY the same 16:9 framing, camera perspective, buildings, rooflines, windows, statues, paths, vegetation, signage and all object positions so toggling day/night feels seamless. Change only lighting, sky and color treatment. Photorealistic calm blue-hour night: deep midnight navy sky with faint natural clouds, cool indigo ambient light, softly visible architecture and foliage, restrained warm illumination from a few existing windows and existing lamps where present. Remove sunlight and daytime glare. Low overall luminance suitable behind a dark interface, preserve readable scene detail without crushed black shadows, gentle navy vignette and darker lower edge matching the source. No additional buildings, objects, people, moon, decorative stars, text, logos or watermarks. One full-bleed landscape image, identical composition and aspect ratio to input.

## App integration

The existing theme button controls the day/night crossfade through the root data-theme attribute. Home uses dormitory-courtyard; Support Booth uses covered-walkway; other routes use campus-building. Compressed WebP pairs are in public/images/campus. PNG originals remain in this directory. The existing theme cookie preserves the selection after reload. Reduced-motion preferences disable the crossfade.

