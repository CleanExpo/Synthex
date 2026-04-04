// Empty stub module — replaces canvg in jspdf browser bundle.
// canvg depends on core-js internals that were removed in core-js 3.x.
// jspdf uses canvg only for SVG-in-PDF rendering, which is not used here.
module.exports = {};
