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
    '90 Furniture People',
    '91 FurnPeep Split',
    'Massing Study',
    '00 Ground',
    'Door - Plan',
    'Door - Dash',
    '22 - Windows in Plan',
    '91 - 1st Floor Plan Cut',
    '92 - 2nd Floor Plan Cut',
    '90 - Foundation Cut',
    '92 - Work Ceiling Cut',
    '93 - Work Trans Sctn',
    '94 - Work Long Sctn',
    'Watermark',
    'Guidelines',
    'Porch Screen'
}

def export_skp_to_glb(skp_path, output_glb_path, textures_dir):
    print(f"\nProcessing: {skp_path}")
    t_start = time.time()
    
    if not os.path.exists(skp_path):
        print(f"Error: {skp_path} does not exist!")
        return False

    os.makedirs(os.path.dirname(output_glb_path), exist_ok=True)
    os.makedirs(textures_dir, exist_ok=True)

    model = sketchup.Model.from_file(skp_path)

    # Load 1024x1024 diffuse textures
    textures = {
        'clapboard': Image.open(os.path.join(textures_dir, "clapboard_diffuse.png")).convert('RGBA'),
        'porch_deck': Image.open(os.path.join(textures_dir, "porch_deck_diffuse.png")).convert('RGBA'),
        'porch_ceiling': Image.open(os.path.join(textures_dir, "porch_ceiling_diffuse.png")).convert('RGBA'),
        'hardwood': Image.open(os.path.join(textures_dir, "hardwood_diffuse.png")).convert('RGBA'),
        'metal_roof': Image.open(os.path.join(textures_dir, "metal_roof_diffuse.png")).convert('RGBA'),
        'brick': Image.open(os.path.join(textures_dir, "brick_diffuse.png")).convert('RGBA'),
        'interior_wall': Image.open(os.path.join(textures_dir, "interior_wall_diffuse.png")).convert('RGBA'),
    }

    buckets = {
        'clapboard': {'verts': [], 'faces': [], 'uvs': []},
        'porch_deck': {'verts': [], 'faces': [], 'uvs': []},
        'porch_ceiling': {'verts': [], 'faces': [], 'uvs': []},
        'hardwood': {'verts': [], 'faces': [], 'uvs': []},
        'metal_roof': {'verts': [], 'faces': [], 'uvs': []},
        'brick': {'verts': [], 'faces': [], 'uvs': []},
        'interior_wall': {'verts': [], 'faces': [], 'uvs': []},
        'trim_white': {'verts': [], 'faces': [], 'uvs': []},
        'glass': {'verts': [], 'faces': [], 'uvs': []},
        'fixtures': {'verts': [], 'faces': [], 'uvs': []},
    }

    def classify(v_w, normal, mat_name, layer_name, comp_name):
        ml = (mat_name or '').lower()
        cl = comp_name.lower()
        ll = layer_name.lower()

        # 1. Explicit SketchUp Materials
        if 'clapboard' in ml or 'siding' in cl:
            return 'clapboard'
        if 'roof' in ml or 'metal' in ml or 'roof' in cl or 'roof' in ll:
            return 'metal_roof'
        if 'brick' in ml or 'chimney' in cl or 'chimney' in ll:
            return 'brick'
        if 'glass' in ml or 'translucent' in ml or 'glass' in cl or 'translucent' in ll:
            return 'glass'
        if 'beadboard' in ml or 'soffit' in cl:
            return 'porch_ceiling'
        if 'silver' in ml or 'lever' in ml or 'louver' in ml or 'fixture' in ll or 'light' in cl or 'bath' in cl or 'stove' in ml or 'stove' in cl:
            return 'fixtures'

        # 2. Geometry coordinates and normals
        ny = normal[1]
        abs_ny = abs(ny)
        xm = float(v_w[:, 0].mean())
        ym = float(v_w[:, 1].mean())
        zm = float(v_w[:, 2].mean())

        # Sloped roofs (Y >= 2.5 and sloped)
        if ym >= 2.5 and 0.15 <= abs_ny <= 0.88:
            return 'metal_roof'

        # Horizontal UP surfaces (Floors / Decking)
        if ny > 0.7:
            # Check if exterior porch or balcony
            if zm >= 14.2 or zm <= 8.6 or abs(xm) >= 3.8 or 'porch' in cl or 'deck' in cl:
                return 'porch_deck'
            return 'hardwood'

        # Horizontal DOWN surfaces (Ceilings / Eaves)
        if ny < -0.7:
            # Exterior porch ceiling or roof soffit overhang
            if zm >= 14.2 or zm <= 8.6 or abs(xm) >= 3.7 or 'porch' in cl or 'soffit' in cl:
                return 'porch_ceiling'
            return 'interior_wall'

        # Trim, Gingerbread, Railings, Posts, Columns, Balusters, Shutters
        if any(k in cl for k in ('trim', 'gingerbread', 'rafter', 'bracket', 'post', 'column', 'spindle', 'rail', 'baluster', 'fascia', 'shutter')) or 'shutter' in ll or 'trim' in ll:
            return 'trim_white'

        # Vertical walls (|ny| < 0.4)
        if abs_ny < 0.4:
            # Front exterior walls: facing front (+Z) at or near porch/front facade
            if normal[2] > 0.3 and zm >= 13.5:
                return 'clapboard'
            # Rear exterior walls: facing rear (-Z)
            if normal[2] < -0.3 and zm <= 9.2:
                return 'clapboard'
            # Side exterior walls on wings or gable ends
            if abs(normal[0]) > 0.3 and (abs(xm) >= 3.6 or zm >= 14.0 or ym >= 4.0):
                return 'clapboard'
            # Any face in finishes layer
            if 'finish' in ll:
                return 'clapboard'
            # Interior room partition wall
            return 'interior_wall'

        return 'trim_white'

    def traverse(entities, transform=np.eye(4), layer_name='Default', comp_name='', parent_mat=None):
        for f in entities.faces:
            vs, tri, uvs = f.tessfaces
            if not tri: continue

            # Convert to Three.js coordinates
            v_w = []
            for v in vs:
                pt = transform @ np.array([v[0], v[1], v[2], 1.0])
                v_w.append([pt[0], pt[2], -pt[1]])
            v_w = np.array(v_w, dtype=np.float32)

            if len(v_w) >= 3:
                e1 = v_w[tri[0][1]] - v_w[tri[0][0]]
                e2 = v_w[tri[0][2]] - v_w[tri[0][0]]
                n = np.cross(e1, e2)
                norm_len = np.linalg.norm(n)
                normal = n / norm_len if norm_len > 1e-6 else np.array([0, 1, 0], dtype=np.float32)
            else:
                normal = np.array([0, 1, 0], dtype=np.float32)

            mat_name = f.material.name if f.material else parent_mat
            cat = classify(v_w, normal, mat_name, layer_name, comp_name)

            b = buckets[cat]
            base_v = len(b['verts'])

            # Planar UV mapping scaled for seamless architectural repeat
            for pt in v_w:
                if cat == 'clapboard':
                    # Siding: U along horizontal wall span, V along height Y
                    # 1 repeat per 1.0 meter (each 1024px tile has 8 planks = 0.125m exposure)
                    u = pt[0] if abs(normal[0]) < abs(normal[2]) else pt[2]
                    v = pt[1]
                    uv = [u * 1.0, v * 1.0]
                elif cat == 'porch_deck':
                    uv = [pt[0] * 1.0, pt[2] * 1.0]
                elif cat == 'porch_ceiling':
                    uv = [pt[0] * 1.5, pt[2] * 1.5]
                elif cat == 'hardwood':
                    uv = [pt[0] * 1.2, pt[2] * 1.2]
                elif cat == 'metal_roof':
                    uv = [pt[0] * 0.8, (pt[1] * 0.707 + pt[2] * 0.707) * 0.8]
                elif cat == 'brick':
                    u = pt[0] if abs(normal[0]) < abs(normal[2]) else pt[2]
                    uv = [u * 1.2, pt[1] * 1.2]
                elif cat == 'interior_wall':
                    u = pt[0] if abs(normal[0]) < abs(normal[2]) else pt[2]
                    uv = [u * 0.5, pt[1] * 0.5]
                else:
                    uv = [pt[0] * 0.5, pt[1] * 0.5]

                b['verts'].append(pt.tolist())
                b['uvs'].append(uv)

            for t in tri:
                b['faces'].append([base_v + t[0], base_v + t[1], base_v + t[2]])

        for g in entities.groups:
            if getattr(g, 'hidden', False): continue
            gl = g.layer.name if g.layer else layer_name
            if gl in SKIP_LAYERS: continue
            g_mat = np.array(g.transform) if getattr(g, 'transform', None) else np.eye(4)
            mat = g.material.name if g.material else parent_mat
            traverse(g.entities, transform @ g_mat, gl, g.name or comp_name, mat)

        for inst in entities.instances:
            if getattr(inst, 'hidden', False): continue
            il = inst.layer.name if inst.layer else layer_name
            if il in SKIP_LAYERS: continue
            i_mat = np.array(inst.transform) if getattr(inst, 'transform', None) else np.eye(4)
            inst_name = inst.definition.name

            # Skip door panel components so doorways are open
            dnl = inst_name.lower()
            if 'swing' in dnl or '2d hinged' in dnl:
                continue

            mat = inst.material.name if inst.material else parent_mat
            traverse(inst.definition.entities, transform @ i_mat, il, inst_name, mat)

    traverse(model.entities)

    # Build PBR materials with baseColorFactor=[1,1,1,1] (100% full brightness)
    pbr_mats = {
        'clapboard': trimesh.visual.material.PBRMaterial(
            name='mat_clapboard',
            baseColorFactor=[1.0, 1.0, 1.0, 1.0],
            roughnessFactor=0.6,
            metallicFactor=0.02,
            baseColorTexture=textures['clapboard']
        ),
        'porch_deck': trimesh.visual.material.PBRMaterial(
            name='mat_porch_deck',
            baseColorFactor=[1.0, 1.0, 1.0, 1.0],
            roughnessFactor=0.5,
            metallicFactor=0.02,
            baseColorTexture=textures['porch_deck']
        ),
        'porch_ceiling': trimesh.visual.material.PBRMaterial(
            name='mat_porch_ceiling',
            baseColorFactor=[1.0, 1.0, 1.0, 1.0],
            roughnessFactor=0.55,
            metallicFactor=0.02,
            baseColorTexture=textures['porch_ceiling']
        ),
        'hardwood': trimesh.visual.material.PBRMaterial(
            name='mat_hardwood',
            baseColorFactor=[1.0, 1.0, 1.0, 1.0],
            roughnessFactor=0.3,
            metallicFactor=0.02,
            baseColorTexture=textures['hardwood']
        ),
        'metal_roof': trimesh.visual.material.PBRMaterial(
            name='mat_metal_roof',
            baseColorFactor=[1.0, 1.0, 1.0, 1.0],
            roughnessFactor=0.35,
            metallicFactor=0.75,
            baseColorTexture=textures['metal_roof']
        ),
        'brick': trimesh.visual.material.PBRMaterial(
            name='mat_brick',
            baseColorFactor=[1.0, 1.0, 1.0, 1.0],
            roughnessFactor=0.8,
            metallicFactor=0.02,
            baseColorTexture=textures['brick']
        ),
        'interior_wall': trimesh.visual.material.PBRMaterial(
            name='mat_interior_wall',
            baseColorFactor=[1.0, 1.0, 1.0, 1.0],
            roughnessFactor=0.85,
            metallicFactor=0.01,
            baseColorTexture=textures['interior_wall']
        ),
    }

    color_configs = {
        'trim_white': {'color': [250, 250, 250, 255], 'roughness': 0.45, 'metalness': 0.05, 'name': 'mat_trim_white'},
        'glass': {'color': [200, 230, 255, 90], 'roughness': 0.05, 'metalness': 0.85, 'name': 'mat_glass'},
        'fixtures': {'color': [210, 215, 220, 255], 'roughness': 0.25, 'metalness': 0.85, 'name': 'mat_fixtures'},
    }

    meshes = []
    print("Submesh breakdown:")
    for cat_name, data in buckets.items():
        n_faces = len(data['faces'])
        print(f"  {cat_name:15s}: {n_faces:6d} faces, {len(data['verts']):6d} verts")
        if not data['faces']: continue

        v = np.array(data['verts'], dtype=np.float32)
        f = np.array(data['faces'], dtype=np.int32)
        uv = np.array(data['uvs'], dtype=np.float32)

        if cat_name in pbr_mats:
            mat = pbr_mats[cat_name]
            visual = trimesh.visual.TextureVisuals(uv=uv, material=mat)
        else:
            cfg = color_configs[cat_name]
            vc = np.tile(cfg['color'], (len(v), 1)).astype(np.uint8)
            visual = trimesh.visual.ColorVisuals(vertex_colors=vc)

        submesh = trimesh.Trimesh(vertices=v, faces=f, visual=visual, process=False)
        submesh.metadata['name'] = f"mesh_{cat_name}"
        meshes.append(submesh)

    scene = trimesh.Scene(meshes)
    glb_bytes = scene.export(file_type='glb')
    os.makedirs(os.path.dirname(output_glb_path), exist_ok=True)
    with open(output_glb_path, 'wb') as fp:
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
    print("RE-EXPORTING ALL 4 MODELS WITH REALISTIC PBR TEXTURES & CLEAN MESHES")
    print("=" * 70)

    for h in houses:
        export_skp_to_glb(h["skp"], h["glb"], textures_dir)

    print("\nAll 4 models successfully exported with realistic PBR textures!")

if __name__ == "__main__":
    main()
