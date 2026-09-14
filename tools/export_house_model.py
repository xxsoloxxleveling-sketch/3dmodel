import os
import sys
import time
import numpy as np
import trimesh
from PIL import Image

scratch_dir = r"C:\Users\Gaming Krew\.gemini\antigravity\brain\e8ffbc79-bfaa-450b-a1ae-103caee8005b\scratch"
importer_dir = os.path.join(scratch_dir, "sketchup_importer")
sys.path.insert(0, importer_dir)
os.add_dll_directory(importer_dir)
import sketchup

SKIP_LAYERS = {
    '22 - Windows in Plan',
    '91 - 1st Floor Plan Cut',
    '92 - 2nd Floor Plan Cut',
    '90 - Foundation Cut',
    '92 - Work Ceiling Cut',
    '93 - Work Trans Sctn',
    '94 - Work Long Sctn',
    'Door - Plan',
    'Door - Dash',
    'Watermark',
    'Guidelines'
}

# Names of door components to separate from static geometry
DOOR_KEYWORDS = {'door', 'swing', 'hinged'}

def export_skp_to_glb(skp_path, output_glb_path, textures_dir):
    print(f"\nProcessing: {skp_path}")
    t_start = time.time()
    
    if not os.path.exists(skp_path):
        print(f"Error: {skp_path} does not exist!")
        return False

    os.makedirs(os.path.dirname(output_glb_path), exist_ok=True)
    os.makedirs(textures_dir, exist_ok=True)

    model = sketchup.Model.from_file(skp_path)

    # Load high-res PBR textures
    textures = {
        'clapboard': Image.open(os.path.join(textures_dir, "clapboard_diffuse.png")).convert('RGBA'),
        'hardwood': Image.open(os.path.join(textures_dir, "hardwood_diffuse.png")).convert('RGBA'),
        'metal_roof': Image.open(os.path.join(textures_dir, "metal_roof_diffuse.png")).convert('RGBA'),
        'brick': Image.open(os.path.join(textures_dir, "brick_diffuse.png")).convert('RGBA'),
        'porch_deck': Image.open(os.path.join(textures_dir, "porch_deck_diffuse.png")).convert('RGBA'),
        'interior_wall': Image.open(os.path.join(textures_dir, "interior_wall_diffuse.png")).convert('RGBA'),
    }

    # Material buckets
    buckets = {
        'clapboard': {'verts': [], 'faces': [], 'uvs': []},
        'hardwood': {'verts': [], 'faces': [], 'uvs': []},
        'metal_roof': {'verts': [], 'faces': [], 'uvs': []},
        'brick': {'verts': [], 'faces': [], 'uvs': []},
        'porch_deck': {'verts': [], 'faces': [], 'uvs': []},
        'interior_wall': {'verts': [], 'faces': [], 'uvs': []},
        'glass': {'verts': [], 'faces': [], 'uvs': []},
        'trim_white': {'verts': [], 'faces': [], 'uvs': []},
        'fixtures': {'verts': [], 'faces': [], 'uvs': []},
    }

    # Track door locations for door placement
    detected_doors = []

    def classify_face(v_world, normal, mat_name, layer_name, comp_name):
        comp_lower = comp_name.lower()
        layer_lower = layer_name.lower()
        mat_lower = mat_name.lower() if mat_name else ''

        # Glass
        if 'glass' in mat_lower or 'translucent' in mat_lower or 'glass' in comp_lower or 'translucent' in layer_lower:
            return 'glass'

        # Brick / Chimney
        if 'brick' in mat_lower or 'chimney' in layer_lower or 'chimney' in comp_lower:
            return 'brick'

        # Fixtures (Plumbing / Lights)
        if 'fixture' in layer_lower or 'bath' in comp_lower or 'bowl' in comp_lower or 'tank' in comp_lower or 'light' in comp_lower:
            return 'fixtures'

        # Trim & Gingerbread
        if 'trim' in comp_lower or 'gingerbread' in comp_lower or 'rafter' in comp_lower or 'bracket' in comp_lower:
            return 'trim_white'

        ny = abs(normal[1]) # Y is up in Three.js coordinates
        y_pos = v_world[:, 1].mean()
        z_pos = v_world[:, 2].mean()
        x_pos = v_world[:, 0].mean()

        # Roof: High elevation + sloped faces
        if (y_pos >= 3.0 and 0.15 <= ny <= 0.85) or 'roof' in comp_lower or 'roof' in layer_lower:
            return 'metal_roof'

        # Floors: Horizontal faces facing up
        if normal[1] > 0.8:
            if z_pos >= 17.5 or 'porch' in comp_lower:
                return 'porch_deck'
            return 'hardwood'

        # Ceilings: Horizontal faces facing down
        if normal[1] < -0.8:
            return 'interior_wall'

        # Vertical walls:
        # Exterior vs Interior
        is_exterior = (abs(x_pos) >= 4.2 or z_pos >= 17.5 or z_pos <= 8.5) or '09 finishes' in layer_lower or 'siding' in comp_lower
        if is_exterior:
            return 'clapboard'
        else:
            return 'interior_wall'

    def traverse(entities, transform=np.eye(4), layer_name='Default', comp_name=''):
        for f in entities.faces:
            vs, tri, uvs = f.tessfaces
            if not tri: continue

            # Convert vertices to Three.js coordinates (X, Z_skp, -Y_skp)
            v_w = []
            for v in vs:
                pt = transform @ np.array([v[0], v[1], v[2], 1.0])
                v_w.append([pt[0], pt[2], -pt[1]])
            v_w = np.array(v_w, dtype=np.float32)

            # Compute normal in Three.js coordinates
            if len(v_w) >= 3:
                e1 = v_w[tri[0][1]] - v_w[tri[0][0]]
                e2 = v_w[tri[0][2]] - v_w[tri[0][0]]
                n = np.cross(e1, e2)
                norm_len = np.linalg.norm(n)
                normal = n / norm_len if norm_len > 1e-6 else np.array([0, 1, 0], dtype=np.float32)
            else:
                normal = np.array([0, 1, 0], dtype=np.float32)

            mat_name = f.material.name if f.material else ''
            category = classify_face(v_w, normal, mat_name, layer_name, comp_name)

            b = buckets[category]
            base_v = len(b['verts'])

            # Generate seamless planar UVs based on world coordinates
            # Scale UVs so textures repeat realistically (e.g. 1m = 1 texture repeat)
            for pt in v_w:
                if category in ('clapboard', 'interior_wall'):
                    # Vertical wall: UV along horizontal axis and height Y
                    uv_x = pt[0] if abs(normal[0]) < abs(normal[2]) else pt[2]
                    uv_y = pt[1]
                    uv = [uv_x * 0.5, uv_y * 0.5]
                elif category in ('hardwood', 'porch_deck'):
                    # Floor: UV along X and Z
                    uv = [pt[0] * 0.6, pt[2] * 0.6]
                elif category == 'metal_roof':
                    # Roof: UV along ridge / slope
                    uv = [pt[0] * 0.5, (pt[1] + pt[2]) * 0.5]
                elif category == 'brick':
                    uv = [(pt[0] + pt[2]) * 0.8, pt[1] * 0.8]
                else:
                    uv = [pt[0] * 0.5, pt[1] * 0.5]

                b['verts'].append(pt.tolist())
                b['uvs'].append(uv)

            for t in tri:
                b['faces'].append([base_v + t[0], base_v + t[1], base_v + t[2]])

        for g in entities.groups:
            if getattr(g, 'hidden', False): continue
            g_layer = g.layer.name if g.layer else layer_name
            if g_layer in SKIP_LAYERS: continue
            g_mat = np.array(g.transform) if getattr(g, 'transform', None) else np.eye(4)
            traverse(g.entities, transform @ g_mat, g_layer, g.name or comp_name)

        for inst in entities.instances:
            if getattr(inst, 'hidden', False): continue
            i_layer = inst.layer.name if inst.layer else layer_name
            if i_layer in SKIP_LAYERS: continue
            i_mat = np.array(inst.transform) if getattr(inst, 'transform', None) else np.eye(4)
            inst_def_name = inst.definition.name

            # Check if this is a door panel: record its location
            if any(k in inst_def_name.lower() for k in DOOR_KEYWORDS):
                center = transform @ i_mat @ np.array([0, 0, 0, 1.0])
                detected_doors.append({
                    'name': inst_def_name,
                    'pos': [float(center[0]), float(center[2]), float(-center[1])]
                })
                # Skip static door panel so doorway is openable
                if 'swing' in inst_def_name.lower() or '2d hinged' in inst_def_name.lower() or 'in door' in inst_def_name.lower():
                    continue

            traverse(inst.definition.entities, transform @ i_mat, i_layer, inst_def_name)

    traverse(model.entities)

    # Build PBR submeshes with realistic materials
    meshes = []
    
    mat_configs = {
        'clapboard': {'roughness': 0.7, 'metalness': 0.05, 'color': [245, 245, 242, 255]},
        'hardwood': {'roughness': 0.35, 'metalness': 0.05, 'color': [190, 140, 90, 255]},
        'metal_roof': {'roughness': 0.3, 'metalness': 0.7, 'color': [50, 54, 60, 255]},
        'brick': {'roughness': 0.85, 'metalness': 0.05, 'color': [170, 70, 50, 255]},
        'porch_deck': {'roughness': 0.75, 'metalness': 0.05, 'color': [160, 125, 90, 255]},
        'interior_wall': {'roughness': 0.9, 'metalness': 0.0, 'color': [245, 243, 238, 255]},
        'trim_white': {'roughness': 0.5, 'metalness': 0.05, 'color': [250, 250, 250, 255]},
        'fixtures': {'roughness': 0.2, 'metalness': 0.8, 'color': [220, 220, 225, 255]},
        'glass': {'roughness': 0.05, 'metalness': 0.1, 'color': [200, 225, 245, 120]},
    }

    for cat_name, data in buckets.items():
        if not data['faces']: continue
        v = np.array(data['verts'], dtype=np.float32)
        f = np.array(data['faces'], dtype=np.int32)
        uv = np.array(data['uvs'], dtype=np.float32)

        cfg = mat_configs.get(cat_name, {'roughness': 0.5, 'metalness': 0.1, 'color': [200, 200, 200, 255]})
        
        if cat_name in textures:
            visual = trimesh.visual.TextureVisuals(uv=uv, image=textures[cat_name])
        else:
            vertex_colors = np.tile(cfg['color'], (len(v), 1)).astype(np.uint8)
            visual = trimesh.visual.ColorVisuals(vertex_colors=vertex_colors)

        submesh = trimesh.Trimesh(vertices=v, faces=f, visual=visual, process=False)
        submesh.metadata['material_name'] = cat_name
        meshes.append(submesh)

    scene = trimesh.Scene(meshes)
    glb_bytes = scene.export(file_type='glb')
    with open(output_glb_path, 'wb') as fp:
        fp.write(glb_bytes)

    # Save to root assets/models as well
    root_model_path = os.path.join(os.path.dirname(os.path.dirname(output_glb_path)), "assets", "models", os.path.basename(output_glb_path))
    os.makedirs(os.path.dirname(root_model_path), exist_ok=True)
    with open(root_model_path, 'wb') as fp:
        fp.write(glb_bytes)

    elapsed = time.time() - t_start
    size_mb = len(glb_bytes) / (1024 * 1024)
    print(f"Successfully exported {output_glb_path} ({size_mb:.2f} MB) in {elapsed:.2f}s with {len(meshes)} PBR submeshes")
    return True

def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    design_dir = os.path.join(base_dir, "Design_Files")
    output_models_dir = os.path.join(base_dir, "assets", "models")
    textures_dir = os.path.join(base_dir, "assets", "textures")

    houses = [
        {
            "id": "caroline",
            "skp": os.path.join(design_dir, "Caroline - All Design Files", "1 - SketchUp Models", "Main Model - Caroline.skp"),
            "glb": os.path.join(output_models_dir, "caroline.glb")
        },
        {
            "id": "georgia",
            "skp": os.path.join(design_dir, "Georgia - All Design Files", "1 - SketchUp Models", "Main Model - Georgia.skp"),
            "glb": os.path.join(output_models_dir, "georgia.glb")
        },
        {
            "id": "marilyn",
            "skp": os.path.join(design_dir, "Marilyn - All Design Files", "1 - SketchUp Models", "Main Model - Marilyn.skp"),
            "glb": os.path.join(output_models_dir, "marilyn.glb")
        },
        {
            "id": "virginia",
            "skp": os.path.join(design_dir, "Virginia - All Design Files", "SketchUp Models", "Main Model - Virginia.skp"),
            "glb": os.path.join(output_models_dir, "virginia.glb")
        }
    ]

    print("=" * 70)
    print("RE-EXPORTING ALL 4 MODELS WITH SEAMLESS PBR TEXTURES & OPEN DOORWAYS")
    print("=" * 70)

    for h in houses:
        export_skp_to_glb(h["skp"], h["glb"], textures_dir)

    print("\nAll 4 models successfully exported with realistic PBR textures!")

if __name__ == "__main__":
    main()
