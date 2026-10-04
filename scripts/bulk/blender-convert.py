# Headless Blender batch converter: FBX/OBJ/Blend -> self-contained GLB.
# Run: Blender -b -P blender-convert.py -- jobs.json   (jobs: [{"src":..., "out":...}])
import bpy, sys, json, os, traceback
jobs = json.load(open(sys.argv[sys.argv.index('--') + 1]))
results = []
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
for j in jobs:
    src, out = j['src'], j['out']
    try:
        reset()
        ext = os.path.splitext(src)[1].lower()
        if ext == '.fbx': bpy.ops.import_scene.fbx(filepath=src)
        elif ext == '.obj': bpy.ops.wm.obj_import(filepath=src)
        elif ext == '.blend': bpy.ops.wm.open_mainfile(filepath=src)
        else: raise Exception('unsupported ' + ext)
        if not any(o.type == 'MESH' for o in bpy.data.objects): raise Exception('no mesh')
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_image_format='AUTO', export_yup=True, export_apply=False, use_selection=False)
        results.append({'src': src, 'out': out, 'ok': True, 'bytes': os.path.getsize(out)})
    except Exception as e:
        results.append({'src': src, 'ok': False, 'error': str(e)[:300]})
json.dump(results, open(sys.argv[sys.argv.index('--') + 1] + '.result', 'w'))
