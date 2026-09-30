/** Forceps geometry shared by the drawing (ForcepsSprite.tsx) and the rig that rotates it. */
export const S = 0.135;
export const VIEW = { x: -300, y: -350, w: 600, h: 760 };
/** Centre of the jaw window: the point that grips the ear (and where the needle passes). */
export const WINDOW = { x: 0, y: -262 };

export const FORCEPS_BOX = {
  width: VIEW.w * S,
  height: VIEW.h * S,
  /** Where the window sits inside the box, in stage pixels: the rig rotates around this point. */
  anchor: { x: (WINDOW.x - VIEW.x) * S, y: (WINDOW.y - VIEW.y) * S },
};
