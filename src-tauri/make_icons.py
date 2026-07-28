#!/usr/bin/env python3

# Generate the app icons for all Tauri build targets.
#
# Tauri needs these icon files:
#   - 32x32.png          (Linux thumbnail and small icon)
#   - 128x128.png        (Linux app icon)
#   - 128x128@2x.png     (Linux high-DPI app icon, 256x256 pixels)
#   - icon.ico           (Windows icon, many sizes)
#   - icon.icns          (macOS icon, many sizes)
#
# This script creates a simple icon from a colored background and a letter.
# It runs on Windows, macOS, and Linux without extra tools.

from PIL import Image, ImageDraw, ImageFont
import os


ICON_DIR = os.path.join(os.path.dirname(__file__), "icons")


def make_base_image(size: int) -> Image.Image:
    """Create a square image with a background color and a letter."""
    image = Image.new("RGBA", (size, size), (59, 130, 246, 255))
    draw = ImageDraw.Draw(image)

    # Try to use a system font for the letter "G".
    # If no font is available, the icon is just the background color.
    try:
        font_size = int(size * 0.6)
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", font_size)
    except OSError:
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except OSError:
            try:
                font = ImageFont.truetype("Arial.ttf", font_size)
            except OSError:
                font = ImageFont.load_default()

    # Center the letter "G" in the square.
    text = "G"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - int(text_height * 0.15)
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

    return image


def save_png(name: str, size: int) -> None:
    """Save one PNG icon with the given file name and pixel size."""
    image = make_base_image(size)
    image.save(os.path.join(ICON_DIR, name), "PNG")


def save_ico() -> None:
    """Save the Windows icon with many sizes in one file."""
    image = make_base_image(256)
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    image.save(os.path.join(ICON_DIR, "icon.ico"), format="ICO", sizes=sizes)


def save_icns() -> None:
    """Save the macOS icon with many sizes in one file."""
    # macOS needs a 1024x1024 source image so Pillow can make all icon sizes.
    image = make_base_image(1024)
    image.save(os.path.join(ICON_DIR, "icon.icns"), "ICNS")


if __name__ == "__main__":
    os.makedirs(ICON_DIR, exist_ok=True)

    save_png("32x32.png", 32)
    save_png("128x128.png", 128)
    save_png("128x128@2x.png", 256)
    save_ico()
    save_icns()

    print("Icons created successfully.")
