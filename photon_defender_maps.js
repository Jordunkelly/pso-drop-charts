/*
 * Map assets for PSO Photon Defender.
 *
 * This module defines the background image and coordinate offsets for
 * each area. Each quadrant of the composite image is 768x512 pixels
 * and corresponds to a different environment. The core game file
 * (photon_defender_core.js) checks for these globals and draws the
 * appropriate segment when rendering the background.
 */

// Preload the composite map image. If this image fails to load,
// the core will fall back to solid colour fills.
const areaBackgroundImg = new Image();
areaBackgroundImg.src = 'areas_background.png';

// Coordinates for cropping each area from the composite image. The
// composite is arranged in two rows and two columns:
// [ forest | caves ]
// [ mines  | ruins ]
const areaCoords = {
  forest: { sx: 0,   sy: 0   },
  caves:  { sx: 768, sy: 0   },
  mines:  { sx: 0,   sy: 512 },
  ruins:  { sx: 768, sy: 512 }
};
