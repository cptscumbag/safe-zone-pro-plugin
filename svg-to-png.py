#!/usr/bin/env python3
"""
Converts overlays/*.svg to overlays/*.png.
Premiere Pro does not support importing SVG as regular footage
("File format not supported"), so the final assets are PNG.

Run: python3 svg-to-png.py
Requires: pip install cairosvg --break-system-packages
"""

import os
import glob
import cairosvg

overlays_dir = os.path.join(os.path.dirname(__file__), "overlays")
svg_files = glob.glob(os.path.join(overlays_dir, "*.svg"))

if not svg_files:
    print("No .svg files found in overlays/. Run generate-overlays.js first.")
    exit(1)

for svg_path in svg_files:
    png_path = svg_path.replace(".svg", ".png")
    cairosvg.svg2png(url=svg_path, write_to=png_path, output_width=1080, output_height=1920)
    print(f"Generated: {png_path}")

print(f"\nDone. {len(svg_files)} PNG files generated.")
