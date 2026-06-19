// Map of raw EXIF lens strings to clean display names.
//
// The build script reads either LensModel or Lens from EXIF and runs that
// string through this alias map for display purposes. Add entries here as
// new lenses show up in your photos.
//
// Key: the raw EXIF lens string (match exactly).
// Value: the display name used on the site.

export const LENS_ALIASES = {
  "OLYMPUS M.14-42mm F3.5-5.6 II R": "Olympus M.Zuiko 14-42mm f/3.5-5.6 II R",
  "OLYMPUS M.40-150mm F4.0-5.6 R": "Olympus M.Zuiko 40-150mm f/4-5.6 R",
  "OLYMPUS M.25mm F1.2": "Olympus M.Zuiko 25mm f/1.2 PRO",
  "LEICA DG 12-60/F2.8-4.0": "Panasonic Leica DG 12-60mm f/2.8-4",
  "EF24-105mm f/4L IS USM": "Canon EF 24-105mm f/4L IS USM",
  "EF50mm f/1.8 II": "Canon EF 50mm f/1.8 II",
  "AF 27/2.8": "TTArtisan AF 27mm f/2.8",
};

// Lens strings to exclude from the /g/ page entirely. Useful for placeholders
// like "N/A" that some cameras write when no lens is reported.
export const LENS_HIDE = new Set([
  "N/A",
  "n/a",
  "----",
  "--",
  "0.0 mm f/0.0",
]);

// Display the lens name through the alias map. Falls back to the raw
// string if no alias is registered.
export function displayLens(raw) {
  if (!raw) return "";
  return LENS_ALIASES[raw] || raw;
}

export function isLensHidden(raw) {
  if (!raw) return true;
  return LENS_HIDE.has(raw) || LENS_HIDE.has(String(raw).trim());
}
