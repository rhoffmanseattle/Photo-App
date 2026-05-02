// Map of raw EXIF camera strings to clean display names.
//
// The build script normalizes Make + Model into a single camera string,
// then runs that string through this alias map for display purposes.
// Add entries here as new cameras show up in your photos.
//
// Key: the normalized make+model string (after dedup, e.g. "Canon Canon"
//   collapses to "Canon"). Match exactly.
// Value: the display name used on the site.
//
// Examples to add as you discover them:
//   "OLYMPUS DIGITAL CAMERA": "Olympus (legacy)",
//   "Apple iPhone 15 Pro": "iPhone 15 Pro",
//   "OM Digital Solutions OM-5": "Olympus OM-5",

export const CAMERA_ALIASES = {
  "Canon EOS DIGITAL REBEL XTi": "Canon EOS Rebel XTi",
  "Apple iPhone": "iPhone",
  "OLYMPUS IMAGING CORP. E-PM1": "Olympus PEN E-PM1",
  "OLYMPUS IMAGING CORP. E-M5MarkII": "Olympus E-M5 MarkII",
  "Panasonic DMC-LX10": "Panasonic Lumix LX10",
};

// Cameras to exclude from the /g/ pages entirely. Useful for junk strings
// that come back from older or generic devices ("OLYMPUS DIGITAL CAMERA"
// when you don't want to surface it). Keys match the normalized string,
// pre-alias.
export const CAMERA_HIDE = new Set([
  // "OLYMPUS DIGITAL CAMERA",
]);

// Display the camera name through the alias map. Falls back to the raw
// string if no alias is registered.
export function displayCamera(raw) {
  if (!raw) return "";
  return CAMERA_ALIASES[raw] || raw;
}

export function isCameraHidden(raw) {
  return CAMERA_HIDE.has(raw);
}
