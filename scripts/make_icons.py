"""Writes frontend/public/icon-192.png and icon-512.png (pure Python, no Pillow)."""
import struct, zlib
from pathlib import Path

BG, FG = (0x7a, 0x2e, 0x1c), (0xfa, 0xf7, 0xf0)

def inside(u, v):  # u, v in 0..64 icon units, same shape as icon.svg
    def arch(cx, cy, rx, ry, x0, x1, y_bottom):
        if x0 <= u <= x1 and cy <= v <= y_bottom:
            return True
        return v < cy and ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1
    outer = arch(32, 30, 18, 21, 14, 50, 52)
    inner = arch(32, 31, 10, 13, 22, 42, 53)
    finial = 30 <= u <= 34 and 4 <= v <= 10
    return (outer and not inner) or finial

def png(size, path):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            row += bytes(FG if inside(x * 64 / size, y * 64 / size) else BG)
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) \
        + chunk(b"IDAT", raw) + chunk(b"IEND", b"")
    Path(path).write_bytes(data)

out = Path(__file__).resolve().parent.parent / "frontend" / "public"
for s in (192, 512):
    png(s, out / f"icon-{s}.png")
print("icons written")
