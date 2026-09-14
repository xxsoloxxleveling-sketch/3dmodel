import os
import sys
import json
import pypdf

sys.stdout.reconfigure(encoding='utf-8')

root_dir = os.path.abspath('Design_Files')

print("=" * 80)
print("COMPREHENSIVE DIRECTORY STRUCTURE ANALYSIS")
print("=" * 80)

# 1. Traverse and build full directory hierarchy
dir_tree = {}
total_files = 0
total_bytes = 0
extension_counts = {}
models = {}

for root, dirs, files in os.walk(root_dir):
    dirs.sort()
    files.sort()
    rel = os.path.relpath(root, root_dir)
    
    for f in files:
        total_files += 1
        fp = os.path.join(root, f)
        sz = os.path.getsize(fp)
        total_bytes += sz
        _, ext = os.path.splitext(f)
        ext = ext.lower()
        extension_counts[ext] = extension_counts.get(ext, 0) + 1
        
        # Determine model
        model_name = rel.split(os.sep)[0] if rel != '.' else 'Root Level'
        if model_name not in models:
            models[model_name] = {'files': [], 'size': 0}
        models[model_name]['files'].append({
            'rel_path': os.path.join(rel, f) if rel != '.' else f,
            'name': f,
            'size': sz,
            'ext': ext
        })
        models[model_name]['size'] += sz

print(f"\nTotal Files: {total_files}")
print(f"Total Disk Usage: {total_bytes / (1024*1024):.2f} MB ({total_bytes / (1024*1024*1024):.2f} GB)\n")

print("File Format Distribution:")
for ext, count in sorted(extension_counts.items()):
    print(f"  {ext.upper()}: {count} files")

print("\n" + "=" * 80)
print("BREAKDOWN BY DESIGN MODEL / FOLDER")
print("=" * 80)

for m_name, m_data in sorted(models.items()):
    print(f"\n📁 [{m_name}] - {len(m_data['files'])} files ({m_data['size'] / (1024*1024):.2f} MB)")
    for fi in m_data['files']:
        print(f"   • {fi['rel_path']} ({fi['size'] / (1024*1024):.2f} MB)")

# 2. PDF Deep Dive
print("\n" + "=" * 80)
print("DEEP DIVE: PDF BLUEPRINT & RENDERING SETS")
print("=" * 80)

for f in sorted(os.listdir(root_dir)):
    if f.endswith('.pdf'):
        p = os.path.join(root_dir, f)
        reader = pypdf.PdfReader(p)
        print(f"\n📄 {f}")
        print(f"   Pages: {len(reader.pages)}")
        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ''
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            
            # Find relevant title block lines
            # Typically architectural title blocks have Sheet Number (e.g., A1.1, S1, etc.) or description
            title = " | ".join(lines[:3]) if lines else "Empty/Raster Only"
            # look for sheet identifiers
            sheet_no = ""
            for l in lines:
                if any(k in l.upper() for k in ['SHEET', 'PAGE', 'COVER', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'S1', 'E1', 'M1']):
                    sheet_no = l
                    break
            print(f"   Page {idx+1:02d}: {title[:80]} (Ref: {sheet_no[:40]})")

# 3. SketchUp (.skp) and LayOut (.layout) structure analysis
print("\n" + "=" * 80)
print("SKETCHUP & CAD COMPONENT ARCHITECTURE")
print("=" * 80)

print("""
The architectural design files follow a modular SketchUp + LayOut drafting workflow:
1. SketchUp Models (.skp):
   - Main Model: Complete 3D structure with massing, walls, finishes, furniture, framing
   - Sections: Pre-cut section planes for generating building cross-sections
   - RCPs: Reflected Ceiling Plans for lighting, fixtures, and ceiling finishes
   - Detail Wall Sections: Structural assemblies showing studs, insulation, vapor barrier, exterior cladding
   - Details: Architectural & structural connection details (e.g. footing, sill, eave, ridge)
   - Doors and Windows: Component schedule library / dynamic door & window components
   - Gingerbread: Architectural ornamentation / trim / brackets / decorative millwork

2. Page Formatting Files (.layout):
   - Blueprints: LayOut documentation linking SketchUp viewport scenes into 2D titleblock sheets
   - Renderings: High-resolution presentation drawings / perspective viewport sheets

3. Alternative CAD Exports (.dxf):
   - 2D CAD vector line exports compatible with AutoCAD, Revit, LibreCAD, etc.

4. Compiled Presentation & Permitting Sets (.pdf):
   - Full consolidated drawing set combining title sheet, floor plans, elevations, sections, details, and 3D renderings
""")
