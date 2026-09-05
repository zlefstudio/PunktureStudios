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

export interface ClampConfig {
  frames: string[];
  naturalWidth: number;
  naturalHeight: number;
  displayHeight: number;
  anchor: { x: number; y: number };
  contactAngle: number;
}

export interface RitualConfigType {
  debug: boolean;
  stageSize: number;
  piercePoint: { x: number; y: number };
  durations: {
    idle: number;
    clean: number;
    mark: number;
    check: number;
    clamp: number;
    pierce: number;
    jewel: number;
    reveal: number;
    total: number;
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
    clamp: ClampConfig;
    needle: ToolConfig;
    forecepwithjew: ToolConfig;
  };
}

export const RITUAL_CONFIG: RitualConfigType = {
  // Set to true to inspect PIERCE_POINT crosshair, tool anchor dots, and stage bounds
  debug: false,

  stageSize: 400, // Fixed logical 400x400 unit stage

  // Contact point on the logo (upper-right helix/cartilage of the right ear)
  piercePoint: { x: 278, y: 188 },

  durations: {
    idle: 1.5,
    clean: 2.0,   // 1.5s -> 3.5s
    mark: 2.0,    // 3.5s -> 5.5s
    check: 2.0,   // 5.5s -> 7.5s
    clamp: 2.0,   // 7.5s -> 9.5s
    pierce: 1.5,  // 9.5s -> 11.0s
    jewel: 2.0,   // 11.0s -> 13.0s
    reveal: 1.0,  // 13.0s -> 14.0s
    total: 14.0,  // Complete loop duration
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
    cottonbuds: {
      src: '/animations/cottonbuds.png',
      naturalWidth: 1408,
      naturalHeight: 768,
      displayHeight: 270,
      anchor: { x: 704, y: 147 }, // Top bud center
      contactAngle: -22,          // Angle held when wiping
    },
    marker: {
      src: '/animations/marker.png',
      naturalWidth: 1408,
      naturalHeight: 768,
      displayHeight: 250,
      anchor: { x: 706, y: 65 },  // Pen tip
      contactAngle: -25,          // Angle held when marking
    },
    mirror: {
      src: '/animations/mirror.png',
      naturalWidth: 1408,
      naturalHeight: 768,
      displayHeight: 260,
      anchor: { x: 701, y: 276 }, // Center of glass face
      inspectAngle: 18,           // Angle held when inspecting
    },
    clamp: {
      frames: [
        '/animations/clampframe1.png',
        '/animations/clampframe2.png',
        '/animations/clampframe3.png',
        '/animations/clampframe4closed.png',
      ],
      naturalWidth: 1376,
      naturalHeight: 768,
      displayHeight: 260,
      anchor: { x: 689, y: 44 },  // Jaw contact point (identical across all 4 frames)
      contactAngle: 16,           // Natural upright contact tilt
    },
    needle: {
      src: '/animations/needle.png',
      naturalWidth: 1408,
      naturalHeight: 768,
      displayHeight: 230,
      anchor: { x: 713, y: 68 },  // Beveled piercing tip
      contactAngle: -26,          // Sharp entry angle
    },
    forecepwithjew: {
      src: '/animations/forecepwithjew.png',
      naturalWidth: 1408,
      naturalHeight: 768,
      displayHeight: 260,
      anchor: { x: 703, y: 72 },  // Gold stud center
      contactAngle: 16,           // Placed at matching angle
    },
  },
};
