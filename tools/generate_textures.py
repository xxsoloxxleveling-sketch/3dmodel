import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def create_textures():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "textures")
    os.makedirs(out_dir, exist_ok=True)
    size = 512

    # 1. Clapboard Exterior Siding (Horizontal white/cream planks with shadow lines)
    img_clap = Image.new("RGB", (size, size), (242, 243, 240))
    draw_clap = ImageDraw.Draw(img_clap)
    plank_h = 32
    for y in range(0, size, plank_h):
        # subtle color variation between planks
        shade = np.random.randint(-4, 5)
        base_c = (242 + shade, 243 + shade, 240 + shade)
        draw_clap.rectangle([0, y, size, y + plank_h], fill=base_c)
        # bottom shadow line
        draw_clap.line([0, y + plank_h - 1, size, y + plank_h - 1], fill=(160, 162, 158), width=2)
        # top highlight line
        draw_clap.line([0, y, size, y], fill=(255, 255, 255), width=1)
    # Add subtle wood grain noise
    noise = np.random.normal(0, 3, (size, size, 3)).astype(np.int16)
    arr_clap = np.clip(np.array(img_clap, dtype=np.int16) + noise, 0, 255).astype(np.uint8)
    Image.fromarray(arr_clap).save(os.path.join(out_dir, "clapboard_diffuse.png"))
    print("Generated clapboard_diffuse.png")

    # 2. Hardwood Flooring (Warm oak planks)
    img_wood = Image.new("RGB", (size, size), (185, 135, 85))
    draw_wood = ImageDraw.Draw(img_wood)
    plank_w = 40
    for x in range(0, size, plank_w):
        # Each plank row has random length staggers
        y = 0
        while y < size:
            plank_len = np.random.choice([96, 128, 160])
            r_shade = np.random.randint(-15, 18)
            col = (195 + r_shade, 140 + int(r_shade * 0.8), 90 + int(r_shade * 0.6))
            draw_wood.rectangle([x, y, x + plank_w, y + plank_len], fill=col)
            # seam shadow
            draw_wood.line([x, y, x + plank_w, y], fill=(90, 60, 35), width=1)
            y += plank_len
        draw_wood.line([x, 0, x, size], fill=(100, 70, 40), width=1)
    # Wood grain noise
    grain = np.random.normal(0, 5, (size, size, 3)).astype(np.int16)
    arr_wood = np.clip(np.array(img_wood, dtype=np.int16) + grain, 0, 255).astype(np.uint8)
    Image.fromarray(arr_wood).save(os.path.join(out_dir, "hardwood_diffuse.png"))
    print("Generated hardwood_diffuse.png")

    # 3. Metal Standing Seam Roof (Architectural dark charcoal with vertical seams)
    img_roof = Image.new("RGB", (size, size), (50, 54, 60))
    draw_roof = ImageDraw.Draw(img_roof)
    seam_w = 48
    for x in range(0, size, seam_w):
        # Base panel
        panel_shade = np.random.randint(-3, 4)
        draw_roof.rectangle([x, 0, x + seam_w, size], fill=(52 + panel_shade, 56 + panel_shade, 62 + panel_shade))
        # Raised seam highlight & shadow
        draw_roof.line([x + seam_w - 3, 0, x + seam_w - 3, size], fill=(95, 102, 112), width=2)
        draw_roof.line([x + seam_w - 1, 0, x + seam_w - 1, size], fill=(30, 32, 36), width=2)
    roof_noise = np.random.normal(0, 2, (size, size, 3)).astype(np.int16)
    arr_roof = np.clip(np.array(img_roof, dtype=np.int16) + roof_noise, 0, 255).astype(np.uint8)
    Image.fromarray(arr_roof).save(os.path.join(out_dir, "metal_roof_diffuse.png"))
    print("Generated metal_roof_diffuse.png")

    # 4. Brick Chimney (Warm Flemish bond red brick with mortar)
    img_brick = Image.new("RGB", (size, size), (165, 65, 45))
    draw_brick = ImageDraw.Draw(img_brick)
    b_h = 24
    b_w = 54
    for row_idx, y in enumerate(range(0, size, b_h)):
        offset = (row_idx % 2) * (b_w // 2)
        for x in range(-offset, size + b_w, b_w):
            b_shade = np.random.randint(-18, 20)
            b_col = (165 + b_shade, 65 + int(b_shade * 0.4), 45 + int(b_shade * 0.3))
            draw_brick.rectangle([x + 2, y + 2, x + b_w - 2, y + b_h - 2], fill=b_col)
            # Mortar lines
            draw_brick.line([x, y, x + b_w, y], fill=(215, 210, 200), width=2)
            draw_brick.line([x, y, x, y + b_h], fill=(215, 210, 200), width=2)
    brick_noise = np.random.normal(0, 6, (size, size, 3)).astype(np.int16)
    arr_brick = np.clip(np.array(img_brick, dtype=np.int16) + brick_noise, 0, 255).astype(np.uint8)
    Image.fromarray(arr_brick).save(os.path.join(out_dir, "brick_diffuse.png"))
    print("Generated brick_diffuse.png")

    # 5. Porch Decking (Treated cedar planks)
    img_deck = Image.new("RGB", (size, size), (160, 125, 90))
    draw_deck = ImageDraw.Draw(img_deck)
    deck_w = 28
    for x in range(0, size, deck_w):
        shade = np.random.randint(-10, 12)
        draw_deck.rectangle([x, 0, x + deck_w, size], fill=(160 + shade, 125 + int(shade * 0.8), 90 + int(shade * 0.6)))
        draw_deck.line([x, 0, x, size], fill=(85, 65, 45), width=2)
    deck_noise = np.random.normal(0, 4, (size, size, 3)).astype(np.int16)
    arr_deck = np.clip(np.array(img_deck, dtype=np.int16) + deck_noise, 0, 255).astype(np.uint8)
    Image.fromarray(arr_deck).save(os.path.join(out_dir, "porch_deck_diffuse.png"))
    print("Generated porch_deck_diffuse.png")

    # 6. Interior Drywall (Warm eggshell white)
    img_wall = Image.new("RGB", (size, size), (245, 243, 238))
    wall_noise = np.random.normal(0, 2.5, (size, size, 3)).astype(np.int16)
    arr_wall = np.clip(np.array(img_wall, dtype=np.int16) + wall_noise, 0, 255).astype(np.uint8)
    Image.fromarray(arr_wall).save(os.path.join(out_dir, "interior_wall_diffuse.png"))
    print("Generated interior_wall_diffuse.png")

if __name__ == "__main__":
    create_textures()
