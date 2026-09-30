/**
 * PIERCING RITUAL CONFIGURATION — Single Source of Truth
 * Exposes all step durations, PIERCE_POINT, per-sprite anchors,
 * logical sizes, held contact angles, and the debug flag.
 * Retunable without touching timeline or component code.
 */

export interface ToolConfig {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  displayHeight: number;
  anchor: { x: number; y: number };
  contactAngle: number;
}

export interface MirrorConfig {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  displayHeight: number;
  anchor: { x: number; y: number };
  inspectAngle: number;
}

/** Forceps are drawn as vector arms (ForcepsSprite.tsx) so the jaws and handles can open and close smoothly. */
export interface ForcepsConfig {
  /** Rotation of the whole tool at the ear. Negative = handles point up and to the right, clear of the face. */
  contactAngle: number;
  /** Degrees each arm swings from closed (0) to fully open. */
  openAngle: number;
}

export interface RitualConfigType {
  debug: boolean;
  stageSize: number;
  piercePoint: { x: number; y: number };
  durations: {
    /** Excited waiting before the first tool arrives (the last 1.2s of the loop continues into it). */
    idle: number;
    clean: number;
    mark: number;
    check: number;
    clamp: number;
    pierce: number;
    jewel: number;
    reveal: number;
    /** Ritual length: the procedure itself, ending after the happy reveal. */
    ritual: number;
    /** Full loop = ritual + a short excited wait, so the logo perks up before the next tools arrive. */
    total: number;
    pace: number;
  };
  logo: {
    src: string;
    naturalWidth: number;
    naturalHeight: number;
    displayWidth: number;
    displayHeight: number;
    center: { x: number; y: number };
  };
  tools: {
    cottonbuds: ToolConfig;
    marker: ToolConfig;
    mirror: MirrorConfig;
    forceps: ForcepsConfig;
    needle: ToolConfig;
  };
}

export const RITUAL_CONFIG: RitualConfigType = {
  // Set to true to inspect PIERCE_POINT crosshair, tool anchor dots, and stage bounds
  debug: false,

  stageSize: 400, // Fixed logical 400x400 unit stage

  // Contact point on the logo (upper-right helix/cartilage of the right ear)
  piercePoint: { x: 294, y: 201 },

  durations: {
    idle: 1.5,
    clean: 2.0,   // 1.5s -> 3.5s
    mark: 2.0,    // 3.5s -> 5.5s
    check: 2.0,   // 5.5s -> 7.5s
    clamp: 2.0,   // 7.5s -> 9.5s
    pierce: 1.5,  // 9.5s -> 11.0s
    jewel: 2.0,   // 11.0s -> 13.0s
    reveal: 1.0,  // 13.0s -> 14.0s
    ritual: 14.0,
    total: 15.2,  // 14.0s -> 15.2s waits happily, then 0 -> 1.5s idle continues the wait
    /** Real seconds per ritual second. 1.25 makes the whole loop 25% slower (19s) without touching the timeline. */
    pace: 1.25,
  },

  logo: {
    src: '/logo.png',
    naturalWidth: 431,
    naturalHeight: 555,
    displayWidth: 230,
    displayHeight: 296.2,
    center: { x: 200, y: 205 },
  },

  tools: {
    // Sprites are cropped to their visible pixels at 3x, so displayHeight is the tool's real
    // on-stage size and the anchor is measured inside the cropped image.
    cottonbuds: {
      src: '/animations/cottonbuds.png',
      naturalWidth: 71,
      naturalHeight: 264,
      displayHeight: 88,
      anchor: { x: 24, y: 32 },  // Top bud center
      contactAngle: -22,         // Angle held when wiping
    },
    marker: {
      src: '/animations/marker.png',
      naturalWidth: 37,
      naturalHeight: 276,
      displayHeight: 92,
      anchor: { x: 18, y: 3 },   // Pen tip
      contactAngle: -25,         // Angle held when marking
    },
    mirror: {
      src: '/animations/mirror.png',
      naturalWidth: 238,
      naturalHeight: 450,
      displayHeight: 150,
      anchor: { x: 117, y: 142 }, // Center of glass face
      inspectAngle: 18,          // Angle held when inspecting
    },
    forceps: {
      contactAngle: -135,        // Comes in from the upper right; the needle uses the lower right
      openAngle: 22,
    },
    needle: {
      src: '/animations/needle.png',
      naturalWidth: 22,
      naturalHeight: 252,
      displayHeight: 84,
      anchor: { x: 13, y: 2 },   // Beveled piercing tip
      contactAngle: -26,         // Sharp entry angle
    },
  },
};
