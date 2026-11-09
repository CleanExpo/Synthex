/**
 * SYN-1404: CCW brand colours and the safe-zone text mask, shared by the CCW
 * compositions (kept here so they do not import each other in a loop).
 */

export const CCW = {
  blue: '#007CC3',
  green: '#39B54A',
  orange: '#F37215',
  ink: '#231F20',
  paper: '#FFFFFF',
  mist: '#EEF6FC',
};

/** QA only: text boxes white on black, everything else hidden. */
export const TEXT_MASK_CSS = `
  .ccw-root, .ccw-root * { background: transparent !important; color: transparent !important;
    box-shadow: none !important; border-color: transparent !important; }
  .ccw-root { background: #000 !important; }
  .ccw-root img, .ccw-root svg { visibility: hidden !important; }
  .ccw-root .ccw-text, .ccw-root .ccw-text * { background: #fff !important; }
  .ccw-root img.ccw-text { visibility: visible !important; background: transparent !important;
    filter: brightness(0) invert(1) !important; mix-blend-mode: normal !important; }
`;
