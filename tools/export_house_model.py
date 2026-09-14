import os
import sys
import time
import json
import numpy as np
import trimesh
from PIL import Image

# Add SketchUp C API importer to python path
scratch_dir = r"C:\Users\Gaming Krew\.gemini\antigravity\brain\e8ffbc79-bfaa-450b-a1ae-103caee8005b\scratch"
importer_dir = os.path.join(scratch_dir, "sketchup_importer")
sys.path.insert(0, importer_dir)
os.add_dll_directory(importer_dir)
import sketchup

# Skip 2D CAD drafting cut layers that are not part of 3D geometry
SKIP_LAYERS = {
    '22 - Windows in Plan',
    '91 - 1st Floor Plan Cut',
    '92 - 2nd Floor Plan Cut',
    '90 - Foundation Cut',
    '92 - Work Ceiling Cut',
    '93 - Work Trans Sctn',
    '94 - Work Long Sctn',
    'Watermark',
    'Guidelines'
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
    
    # Extract materials and textures
    materials_data = {}
    for m in model.materials:
        color = [c / 255.0 for c in m.color[:3]] + [float(m.opacity)]
        tex_img = None
        if m.texture:
            tex_filename = m.name.replace('/', '_').replace('\\', '_').replace(' ', '_') + '.png'
            out_p = os.path.join(textures_dir, tex_filename)
            if not os.path.exists(out_p):
                try:
                    m.texture.write(out_p)
                except Exception as e:
                    pass
            if os.path.exists(out_p):
                try:
                    tex_img = Image.open(out_p).convert('RGBA')
                except Exception as e:
                    print(f"Error loading texture {out_p}: {e}")
                    
        materials_data[m.name] = {
            'color': color,
            'texture': tex_img,
            'opacity': float(m.opacity)
        }
        
    # Buckets by material
    buckets = {}
    
    def traverse(entities, transform=np.eye(4)):
        for f in entities.faces:
            vs, tri, uvs = f.tessfaces
            mat_name = f.material.name if f.material else 'Default'
            if mat_name not in buckets:
                buckets[mat_name] = {'verts': [], 'faces': [], 'uvs': []}
                
            b = buckets[mat_name]
            base_v = len(b['verts'])
            
            for v, uv in zip(vs, uvs):
                pt = np.array([v[0], v[1], v[2], 1.0])
                pt_w = transform @ pt
                # SketchUp coords: X right, Y depth, Z up
                # Three.js coords: X right, Y up, Z -depth
                b['verts'].append([pt_w[0], pt_w[2], -pt_w[1]])
                b['uvs'].append([uv[0], uv[1]])
                
            for t in tri:
                b['faces'].append([base_v + t[0], base_v + t[1], base_v + t[2]])
                
        for g in entities.groups:
            if getattr(g, 'hidden', False): continue
            if g.layer and g.layer.name in SKIP_LAYERS: continue
            g_mat = np.array(g.transform) if getattr(g, 'transform', None) else np.eye(4)
            traverse(g.entities, transform @ g_mat)
            
        for inst in entities.instances:
            if getattr(inst, 'hidden', False): continue
            if inst.layer and inst.layer.name in SKIP_LAYERS: continue
            i_mat = np.array(inst.transform) if getattr(inst, 'transform', None) else np.eye(4)
            traverse(inst.definition.entities, transform @ i_mat)
            
    traverse(model.entities)
    
    total_verts = sum(len(b['verts']) for b in buckets.values())
    total_triangles = sum(len(b['faces']) for b in buckets.values())
    print(f"Extracted {total_verts} vertices, {total_triangles} triangles across {len(buckets)} material groups")
    
    # Build trimesh submeshes
    meshes = []
    for mat_name, data in buckets.items():
        if not data['faces']: continue
        v = np.array(data['verts'], dtype=np.float32)
        f = np.array(data['faces'], dtype=np.int32)
        uv = np.array(data['uvs'], dtype=np.float32) if data['uvs'] else None
        
        m_info = materials_data.get(mat_name, {'color': [0.8, 0.8, 0.8, 1.0], 'texture': None})
        color_uint8 = [int(c * 255) for c in m_info['color']]
        
        visual = None
        if m_info['texture'] is not None and uv is not None and len(uv) == len(v):
            visual = trimesh.visual.TextureVisuals(uv=uv, image=m_info['texture'])
        else:
            vertex_colors = np.tile(color_uint8, (len(v), 1))
            visual = trimesh.visual.ColorVisuals(vertex_colors=vertex_colors)
            
        submesh = trimesh.Trimesh(vertices=v, faces=f, visual=visual, process=False)
        submesh.metadata['material_name'] = mat_name
        meshes.append(submesh)
        
    scene = trimesh.Scene(meshes)
    glb_bytes = scene.export(file_type='glb')
    with open(output_glb_path, 'wb') as fp:
        fp.write(glb_bytes)
        
    elapsed = time.time() - t_start
    size_mb = len(glb_bytes) / (1024 * 1024)
    print(f"Successfully generated: {output_glb_path} ({size_mb:.2f} MB) in {elapsed:.2f}s")
    return True

def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    design_dir = os.path.join(base_dir, "Design_Files")
    output_models_dir = os.path.join(base_dir, "game", "assets", "models")
    textures_dir = os.path.join(base_dir, "game", "assets", "textures")
    
    houses = [
        {
            "id": "caroline",
            "name": "Caroline's Starter Farmhouse",
            "skp": os.path.join(design_dir, "Caroline - All Design Files", "1 - SketchUp Models", "Main Model - Caroline.skp"),
            "glb": os.path.join(output_models_dir, "caroline.glb")
        },
        {
            "id": "georgia",
            "name": "Georgia's Starter Farmhouse",
            "skp": os.path.join(design_dir, "Georgia - All Design Files", "1 - SketchUp Models", "Main Model - Georgia.skp"),
            "glb": os.path.join(output_models_dir, "georgia.glb")
        },
        {
            "id": "marilyn",
            "name": "Marilyn's Starter Farmhouse",
            "skp": os.path.join(design_dir, "Marilyn - All Design Files", "1 - SketchUp Models", "Main Model - Marilyn.skp"),
            "glb": os.path.join(output_models_dir, "marilyn.glb")
        },
        {
            "id": "virginia",
            "name": "Virginia's Farmhouse",
            "skp": os.path.join(design_dir, "Virginia - All Design Files", "SketchUp Models", "Main Model - Virginia.skp"),
            "glb": os.path.join(output_models_dir, "virginia.glb")
        }
    ]
    
    print("=" * 70)
    print("EXPORTING ALL 4 STARTER FARMHOUSE 3D MODELS TO OPTIMIZED GLB")
    print("=" * 70)
    
    for h in houses:
        export_skp_to_glb(h["skp"], h["glb"], textures_dir)
        
    print("\nAll house models successfully converted to web-ready GLB!")

if __name__ == "__main__":
    main()
