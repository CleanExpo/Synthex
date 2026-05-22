/**
 * Verifies that an uploaded OOXML document is backed by a ZIP container.
 */
export function hasZipMagic(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const b0 = buffer[0];
  const b1 = buffer[1];
  const b2 = buffer[2];
  const b3 = buffer[3];
  return (
    b0 === 0x50 &&
    b1 === 0x4b &&
    (b2 === 0x03 || b2 === 0x05 || b2 === 0x07) &&
    (b3 === 0x04 || b3 === 0x06 || b3 === 0x08)
  );
}
