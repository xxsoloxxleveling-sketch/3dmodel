import os
import numpy as np
from PIL import Image, ImageDraw

def generate_normal_from_height(height_map, strength=3.0):
    """Generate OpenGL tangent-space normal map from a height map."""
    h = height_map.astype(np.float32) / 255.0
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    dy = (np.roll(h, 1, axis=0) - np.roll(h, -1, axis=0)) * strength
    dz = np.ones_like(h)

    length = np.sqrt(dx * dx + dy * dy + dz * dz)
    nx = dx / length
    ny = dy / length
    nz = dz / length

    r = ((nx * 0.5 + 0.5) * 255).astype(np.uint8)
    g = ((ny * 0.5 + 0.5) * 255).astype(np.uint8)
    b = ((nz * 0.5 + 0.5) * 255).astype(np.uint8)
    return np.stack([r, g, b], axis=-1)

def create_textures():
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "textures"))
    os.makedirs(out_dir, exist_ok=True)
    size = 1024

    print(f"Generating ultra-realistic 1024x1024 textures in {out_dir}...")

    # =========================================================================
    # 1. CLAPBOARD SIDING - High-Definition Lap Siding with Deep Shadow Grooves
    # =========================================================================
    # 8 planks per tile -> 128px per plank (~0.125m exposure in real scale)
    plank_h = 128
    arr_clap = np.zeros((size, size, 3), dtype=np.float32)
    height_clap = np.zeros((size, size), dtype=np.float32)

    for i, y in enumerate(range(0, size, plank_h)):
        # Alternate subtle warm board tone
        shade = -5 if (i % 2 == 0) else 5
        base_r = 232 + shade
        base_g = 228 + shade
        base_b = 220 + shade

        for r in range(plank_h):
            row_y = y + r
            if r < 14:
                # Under-lap ambient shadow from upper board
                t = r / 14.0
                factor = 0.78 + t * 0.22
            elif r >= plank_h - 14:
                # Bottom overlap drop-off shadow groove (distinct 3D bevel shadow)
                t = (plank_h - 1 - r) / 13.0
                factor = 0.48 + t * 0.52
            else:
                # Plank face with slight upward taper
                factor = 0.96 + (r / float(plank_h)) * 0.08

            arr_clap[row_y, :, 0] = base_r * factor
            arr_clap[row_y, :, 1] = base_g * factor
            arr_clap[row_y, :, 2] = base_b * factor

            # Physical bevel height slope for normal map
            height_clap[row_y, :] = 60 + (r / float(plank_h)) * 180

    # Fine horizontal cedar grain
    for _ in range(90):
        sy = np.random.randint(0, size)
        sx_len = np.random.randint(200, size)
        sx_start = np.random.randint(0, size - sx_len + 1)
        arr_clap[sy, sx_start:sx_start+sx_len, :] -= np.random.uniform(4, 10)

    arr_clap = np.clip(arr_clap, 0, 255).astype(np.uint8)
    Image.fromarray(arr_clap).save(os.path.join(out_dir, "clapboard_diffuse.png"))
    norm_clap = generate_normal_from_height(height_clap, strength=3.5)
    Image.fromarray(norm_clap).save(os.path.join(out_dir, "clapboard_normal.png"))
    print("  [OK] clapboard_diffuse.png & clapboard_normal.png")

    # =========================================================================
    # 2. METAL ROOF - Standing Seam Charcoal Slate
    # =========================================================================
    arr_roof = np.zeros((size, size, 3), dtype=np.float32)
    height_roof = np.full((size, size), 100, dtype=np.float32)
    seam_w = 128

    for x in range(0, size, seam_w):
        p_shade = np.random.randint(-4, 5)
        base = np.array([48 + p_shade, 52 + p_shade, 58 + p_shade], dtype=np.float32)
        arr_roof[:, x:x+seam_w] = base

        # Raised standing seam: highlight on left, dark shadow on right
        arr_roof[:, x + seam_w - 8 : x + seam_w - 4] = [125, 135, 148]
        arr_roof[:, x + seam_w - 4 : x + seam_w - 2] = [80, 88, 98]
        arr_roof[:, x + seam_w - 2 : x + seam_w] = [20, 22, 26]

        height_roof[:, x + seam_w - 8 : x + seam_w - 2] = 240
        height_roof[:, x + seam_w - 2 : x + seam_w + 2] = 50

    arr_roof = np.clip(arr_roof + np.random.normal(0, 2, (size, size, 3)), 0, 255).astype(np.uint8)
    Image.fromarray(arr_roof).save(os.path.join(out_dir, "metal_roof_diffuse.png"))
    norm_roof = generate_normal_from_height(height_roof, strength=3.0)
    Image.fromarray(norm_roof).save(os.path.join(out_dir, "metal_roof_normal.png"))
    print("  [OK] metal_roof_diffuse.png & metal_roof_normal.png")

    # =========================================================================
    # 3. HARDWOOD FLOORING - Warm Honey Oak Planks
    # =========================================================================
    img_wood = Image.new("RGB", (size, size), (198, 144, 92))
    draw_wood = ImageDraw.Draw(img_wood)
    height_wood = np.full((size, size), 180, dtype=np.float32)
    plank_w = 64

    for x in range(0, size, plank_w):
        y = 0
        while y < size:
            p_len = int(np.random.choice([256, 384, 512]))
            p_end = min(y + p_len, size)
            r_shade = np.random.randint(-18, 20)
            col = (
                int(np.clip(198 + r_shade, 0, 255)),
                int(np.clip(144 + int(r_shade * 0.75), 0, 255)),
                int(np.clip(92 + int(r_shade * 0.5), 0, 255))
            )
            draw_wood.rectangle([x, y, x + plank_w, p_end], fill=col)

            for _ in range(8):
                gx = x + np.random.randint(4, plank_w - 4)
                g_col = (max(0, col[0] - 14), max(0, col[1] - 12), max(0, col[2] - 10))
                draw_wood.line([gx, y, gx, p_end], fill=g_col, width=1)

            if p_end < size:
                draw_wood.line([x, p_end - 2, x + plank_w, p_end - 2], fill=(70, 42, 20), width=3)
                height_wood[p_end - 2 : p_end + 2, x : x + plank_w] = 50

            y = p_end

        draw_wood.line([x, 0, x, size], fill=(80, 50, 25), width=3)
        height_wood[:, max(0, x - 2) : min(size, x + 3)] = 50

    arr_wood = np.clip(np.array(img_wood, dtype=np.int16) + np.random.normal(0, 3, (size, size, 3)).astype(np.int16), 0, 255).astype(np.uint8)
    Image.fromarray(arr_wood).save(os.path.join(out_dir, "hardwood_diffuse.png"))
    norm_wood = generate_normal_from_height(height_wood, strength=2.5)
    Image.fromarray(norm_wood).save(os.path.join(out_dir, "hardwood_normal.png"))
    print("  [OK] hardwood_diffuse.png & hardwood_normal.png")

    # =========================================================================
    # 4. PORCH DECKING - Natural Cedar Planks with Drainage Gaps
    # =========================================================================
    img_deck = Image.new("RGB", (size, size), (168, 130, 92))
    draw_deck = ImageDraw.Draw(img_deck)
    height_deck = np.full((size, size), 190, dtype=np.float32)
    deck_w = 64

    for x in range(0, size, deck_w):
        shade = np.random.randint(-12, 14)
        col = (168 + shade, 130 + int(shade * 0.8), 92 + int(shade * 0.6))
        draw_deck.rectangle([x, 0, x + deck_w, size], fill=col)

        for _ in range(6):
            gx = x + np.random.randint(4, deck_w - 4)
            draw_deck.line([gx, 0, gx, size], fill=(col[0] - 12, col[1] - 10, col[2] - 8), width=1)

        draw_deck.line([x, 0, x, size], fill=(45, 30, 18), width=4)
        draw_deck.line([x + 3, 0, x + 3, size], fill=(205, 165, 120), width=1)
        height_deck[:, max(0, x - 2) : min(size, x + 4)] = 30

    arr_deck = np.clip(np.array(img_deck, dtype=np.int16) + np.random.normal(0, 3, (size, size, 3)).astype(np.int16), 0, 255).astype(np.uint8)
    Image.fromarray(arr_deck).save(os.path.join(out_dir, "porch_deck_diffuse.png"))
    norm_deck = generate_normal_from_height(height_deck, strength=2.5)
    Image.fromarray(norm_deck).save(os.path.join(out_dir, "porch_deck_normal.png"))
    print("  [OK] porch_deck_diffuse.png & porch_deck_normal.png")

    # =========================================================================
    # 5. PORCH CEILING / SOFFIT - Warm Pine Beadboard
    # =========================================================================
    img_soffit = Image.new("RGB", (size, size), (222, 184, 138))
    draw_soffit = ImageDraw.Draw(img_soffit)
    height_soffit = np.full((size, size), 180, dtype=np.float32)
    bead_w = 48

    for x in range(0, size, bead_w):
        b_shade = np.random.randint(-8, 10)
        col = (222 + b_shade, 184 + int(b_shade * 0.8), 138 + int(b_shade * 0.6))
        draw_soffit.rectangle([x, 0, x + bead_w, size], fill=col)

        cx = x + bead_w // 2
        draw_soffit.line([cx - 1, 0, cx - 1, size], fill=(130, 95, 58), width=2)
        draw_soffit.line([cx + 1, 0, cx + 1, size], fill=(245, 210, 165), width=1)

        draw_soffit.line([x, 0, x, size], fill=(115, 80, 48), width=3)
        height_soffit[:, max(0, x - 2) : min(size, x + 3)] = 50
        height_soffit[:, max(0, cx - 1) : min(size, cx + 2)] = 90

    arr_soffit = np.clip(np.array(img_soffit, dtype=np.int16) + np.random.normal(0, 2.5, (size, size, 3)).astype(np.int16), 0, 255).astype(np.uint8)
    Image.fromarray(arr_soffit).save(os.path.join(out_dir, "porch_ceiling_diffuse.png"))
    norm_soffit = generate_normal_from_height(height_soffit, strength=2.2)
    Image.fromarray(norm_soffit).save(os.path.join(out_dir, "porch_ceiling_normal.png"))
    print("  [OK] porch_ceiling_diffuse.png & porch_ceiling_normal.png")

    # =========================================================================
    # 6. BRICK CHIMNEY - Red Flemish Bond Brick with Mortar
    # =========================================================================
    img_brick = Image.new("RGB", (size, size), (175, 72, 50))
    draw_brick = ImageDraw.Draw(img_brick)
    height_brick = np.full((size, size), 190, dtype=np.float32)
    b_h = 40
    b_w = 96
    mortar_color = (215, 212, 205)

    for row_idx, y in enumerate(range(0, size, b_h)):
        offset = (row_idx % 2) * (b_w // 2)
        for x in range(-offset, size + b_w, b_w):
            b_shade = np.random.randint(-22, 24)
            col = (
                int(np.clip(175 + b_shade, 0, 255)),
                int(np.clip(72 + int(b_shade * 0.45), 0, 255)),
                int(np.clip(50 + int(b_shade * 0.35), 0, 255))
            )
            draw_brick.rectangle([x + 3, y + 3, x + b_w - 3, y + b_h - 3], fill=col)
            draw_brick.line([x, y, x + b_w, y], fill=mortar_color, width=4)
            draw_brick.line([x, y, x, y + b_h], fill=mortar_color, width=4)

            height_brick[max(0, y - 2) : min(size, y + 3), :] = 50
            height_brick[:, max(0, x - 2) : min(size, x + 3)] = 50

    arr_brick = np.clip(np.array(img_brick, dtype=np.int16) + np.random.normal(0, 4.5, (size, size, 3)).astype(np.int16), 0, 255).astype(np.uint8)
    Image.fromarray(arr_brick).save(os.path.join(out_dir, "brick_diffuse.png"))
    norm_brick = generate_normal_from_height(height_brick, strength=2.8)
    Image.fromarray(norm_brick).save(os.path.join(out_dir, "brick_normal.png"))
    print("  [OK] brick_diffuse.png & brick_normal.png")

    # =========================================================================
    # 7. INTERIOR DRYWALL - Warm Eggshell Paint
    # =========================================================================
    img_drywall = Image.new("RGB", (size, size), (248, 246, 240))
    arr_drywall = np.clip(np.array(img_drywall, dtype=np.int16) + np.random.normal(0, 2.0, (size, size, 3)).astype(np.int16), 0, 255).astype(np.uint8)
    Image.fromarray(arr_drywall).save(os.path.join(out_dir, "interior_wall_diffuse.png"))
    print("  [OK] interior_wall_diffuse.png")

    # =========================================================================
    # 8. DOOR WOOD - Rich Walnut / Mahogany for Doors
    # =========================================================================
    img_door = Image.new("RGB", (size, size), (135, 82, 45))
    draw_door = ImageDraw.Draw(img_door)
    for _ in range(40):
        gy = np.random.randint(0, size)
        draw_door.line([0, gy, size, gy], fill=(115, 68, 35), width=np.random.randint(1, 3))
    draw_door.rectangle([60, 60, size - 60, size - 60], outline=(80, 45, 22), width=10)
    draw_door.rectangle([70, 70, size - 70, size - 70], outline=(175, 115, 65), width=6)
    draw_door.rectangle([100, 100, size - 100, size - 100], fill=(125, 75, 40))
    arr_door = np.clip(np.array(img_door, dtype=np.int16) + np.random.normal(0, 2.5, (size, size, 3)).astype(np.int16), 0, 255).astype(np.uint8)
    Image.fromarray(arr_door).save(os.path.join(out_dir, "door_wood_diffuse.png"))
    print("  [OK] door_wood_diffuse.png")

    print("\nAll realistic PBR textures generated successfully in assets/textures/!")

if __name__ == "__main__":
    create_textures()
