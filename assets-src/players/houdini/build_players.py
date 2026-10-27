# Kangs players: builds the base athletic body and its guard / forward / center variants in Houdini (Apprentice is fine).
# Run it from Houdini's Python Shell (Windows > Python Shell):
#   exec(open('/Users/raghav/coding/kangs-assets/houdini/build_players.py').read())
# What it makes in /obj:
#   kangs_body     the base body. Its "Kangs body" tab has Height (m), Shoulder width, Muscle mass, Blend radius,
#                  voxel size and triangle targets; change a value and the body rebuilds.
#   kangs_guard / kangs_forward / kangs_center   copies of the base set to the values in body_shapes.json.
# How the body is made: every entry of body_shapes.json (ellipsoids and tapered capsules) becomes a signed distance
# function; a Volume Wrangle smooth-unions them (blend radius) into one SDF volume per part (body, left arm, right arm,
# so arms hanging close to the torso never fuse to it), which is meshed, reduced to the triangle budget, UV-unwrapped
# and exported as OBJ (mesh + UVs + part groups) to kangs-assets/houdini/export/.
# scripts/build_players.py in the game repo reads the same body_shapes.json, adds the skeleton and skin weights and
# writes the glTF the game loads (Apprentice cannot export glTF or FBX itself).
import hou, json, os

ASSETS = '/Users/raghav/coding/kangs-assets'
SPEC = ASSETS + '/body_shapes.json'
EXPORT = ASSETS + '/houdini/export'
PARTS = ('core', 'arm_L', 'arm_R')

# Python SOP: one point per shape, carrying what the SDF needs (all in metres, scaled by the body's parameters).
SHAPES_SOP = r'''
import hou, json
node = hou.pwd(); geo = node.geometry(); body = node.parent()
H = body.evalParm('height_m'); SH = body.evalParm('shoulder'); M = body.evalParm('mass')
spec = json.load(open(body.evalParm('spec_path')))
for name, default in (('kind', 0), ('part', ''), ('r', (0.0, 0.0, 0.0)), ('basis', (0.0,) * 9), ('ra', 0.0), ('rb', 0.0), ('aspect', 1.0), ('len', 0.0), ('shape', '')):
    geo.addAttrib(hou.attribType.Point, name, default)
def pos(p, sx):
    return hou.Vector3(p[0] * (SH if sx else 1) * H, p[1] * H, p[2] * H)
for s in spec['shapes']:
    k = M ** s['m']
    pt = geo.createPoint()
    pt.setAttribValue('part', s['part']); pt.setAttribValue('shape', s['name'])
    if s['kind'] == 'ell':
        r = [v * k * H for v in s['r']]
        if s['sx']: r[0] *= SH ** 0.5
        R = hou.hmath.buildRotate(hou.Vector3(s['rot'])).extractRotationMatrix3()
        Rt = R.transposed()
        pt.setPosition(pos(s['c'], s['sx']))
        pt.setAttribValue('kind', 0); pt.setAttribValue('r', r)
        pt.setAttribValue('basis', [Rt.at(i, j) for i in range(3) for j in range(3)])
    else:
        a = pos(s['a'], s['sx']); b = pos(s['b'], s['sx'])
        ra = s['ra'] * k * H; rb = s['rb'] * k * H
        if s['sx']: ra *= SH ** 0.25; rb *= SH ** 0.25
        d = b - a; L = d.length(); d = d.normalized()
        if abs(d[1]) > 0.7:
            xa = hou.Vector3(1, 0, 0)
        else:
            xa = hou.Vector3(0, 1, 0) if abs(d[0]) < 0.7 else hou.Vector3(0, 0, 1)
        xa = (xa - d * xa.dot(d)).normalized(); za = xa.cross(d).normalized()
        if za[2] < 0 and abs(d[1]) > 0.7: za = -za
        pt.setPosition(a)
        pt.setAttribValue('kind', 1); pt.setAttribValue('ra', ra); pt.setAttribValue('rb', rb); pt.setAttribValue('len', L)
        pt.setAttribValue('aspect', s['aspect'])
        # columns are the local axes, so (P - a) * basis = (along x, along the bone, along z)
        pt.setAttribValue('basis', [xa[0], d[0], za[0], xa[1], d[1], za[1], xa[2], d[2], za[2]])
'''

# Volume Wrangle: smooth union of every shape of one part. density = -distance, so the surface is the 0 iso.
SDF_VEX = r'''
float smin(float a; float b; float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float roundcone(vector q; float r1; float r2; float h) {
    float b = (r1 - r2) / h; float a = sqrt(max(1.0 - b * b, 1e-6));
    vector2 w = set(length(set(q.x, q.z)), q.y);
    float k = dot(w, set(-b, a));
    if (k < 0.0) return length(w) - r1;
    if (k > a * h) return length(w - set(0.0, h)) - r2;
    return dot(w, set(a, b)) - r1;
}
float blend = max(ch("../blend"), 1e-4);
float d = 1e9;
int n = npoints(1);
for (int i = 0; i < n; i++) {
    if (point(1, "part", i) != "PART") continue;
    vector c = point(1, "P", i);
    matrix3 m = point(1, "basis", i);
    vector q = (v@P - c) * m;
    float s;
    if (point(1, "kind", i) == 0) {
        vector r = point(1, "r", i);
        float k0 = length(q / r); float k1 = length(q / (r * r));
        s = k0 * (k0 - 1.0) / max(k1, 1e-6);
    } else {
        q.z /= point(1, "aspect", i);
        s = roundcone(q, point(1, "ra", i), point(1, "rb", i), max(point(1, "len", i), 1e-4));
    }
    d = d > 1e8 ? s : smin(d, s, blend);
}
f@surface = -d;
'''

# Volume box per part, as fractions of height (centre and size); x of arms follows the shoulder factor.
BOX = {'core': ((0, .5, .02), (.34, 1.04, .26), False),
       'arm_L': ((.123, .61, .005), (.11, .5, .12), True),
       'arm_R': ((-.123, .61, .005), (.11, .5, .12), True)}

def add_parms(geo, v):
    ptg = geo.parmTemplateGroup()
    f = hou.FolderParmTemplate('kangs', 'Kangs body')
    f.addParmTemplate(hou.FloatParmTemplate('height_m', 'Height (m)', 1, default_value=(v['height_m'],), min=1.6, max=2.4))
    f.addParmTemplate(hou.FloatParmTemplate('shoulder', 'Shoulder width', 1, default_value=(v['shoulder'],), min=0.8, max=1.25))
    f.addParmTemplate(hou.FloatParmTemplate('mass', 'Muscle mass', 1, default_value=(v['mass'],), min=0.7, max=1.4))
    f.addParmTemplate(hou.FloatParmTemplate('blend', 'Blend radius (m)', 1, default_value=(0.03,), min=0.001, max=0.08))
    f.addParmTemplate(hou.FloatParmTemplate('voxel', 'Voxel size (m)', 1, default_value=(0.006,), min=0.003, max=0.02))
    f.addParmTemplate(hou.IntParmTemplate('target_core', 'Triangles: body', 1, default_value=(7000,), min=1000, max=40000))
    f.addParmTemplate(hou.IntParmTemplate('target_arm', 'Triangles: each arm', 1, default_value=(900,), min=200, max=8000))
    f.addParmTemplate(hou.ToggleParmTemplate('do_uv', 'Unwrap UVs', default_value=True))
    f.addParmTemplate(hou.StringParmTemplate('spec_path', 'Shape table', 1, default_value=(SPEC,), string_type=hou.stringParmType.FileReference))
    f.addParmTemplate(hou.StringParmTemplate('export_path', 'Export OBJ', 1, default_value=(EXPORT + '/' + geo.name() + '.obj',), string_type=hou.stringParmType.FileReference))
    ptg.append(f)
    geo.setParmTemplateGroup(ptg)

def build(name, v, tx=0.0, overrides=None):
    obj = hou.node('/obj')
    old = obj.node(name)
    if old: old.destroy()
    geo = obj.createNode('geo', name)
    geo.parmTuple('t').set((tx, 0, 0))
    add_parms(geo, v)
    for k, val in (overrides or {}).items():
        geo.parm(k).set(val)
    shapes = geo.createNode('python', 'shapes'); shapes.parm('python').set(SHAPES_SOP)
    merge = geo.createNode('merge', 'body')
    for part in PARTS:
        (cx, cy, cz), (sx, sy, sz), side = BOX[part]
        vol = geo.createNode('volume', 'box_' + part)
        vol.parm('name').set('surface')
        sh = '*ch("../shoulder")' if side else ''
        for axis, val, size in (('x', cx, sx), ('y', cy, sy), ('z', cz, sz)):
            vol.parm('t' + axis).setExpression('%f*ch("../height_m")%s' % (val, sh if axis == 'x' else ''))
            vol.parm('size' + axis).setExpression('%f*ch("../height_m")%s' % (size, sh if axis == 'x' else ''))
        vol.parm('uniformsamples').set('size'); vol.parm('divsize').setExpression('ch("../voxel")')
        wr = geo.createNode('volumewrangle', 'sdf_' + part); wr.setInput(0, vol); wr.setInput(1, shapes)
        wr.parm('snippet').set(SDF_VEX.replace('PART', part))
        mesh = geo.createNode('convertvolume', 'mesh_' + part); mesh.setInput(0, wr); mesh.parm('iso').set(0)
        red = geo.createNode('polyreduce::2.0', 'reduce_' + part); red.setInput(0, mesh)
        red.parm('target').set('poly_count'); red.parm('finalcount').setExpression('ch("../%s")' % ('target_core' if part == 'core' else 'target_arm'))
        grp = geo.createNode('groupcreate', 'group_' + part); grp.setInput(0, red); grp.parm('groupname').set(part)
        merge.setNextInput(grp)
    nrm = geo.createNode('normal', 'smooth_normals'); nrm.setInput(0, merge); nrm.parm('type').set('typepoint')
    seams = geo.createNode('uvautoseam', 'uv_seams'); seams.setInput(0, nrm)
    flat = geo.createNode('uvflatten::3.0', 'uv_flatten'); flat.setInput(0, seams)
    lay = geo.createNode('uvlayout::3.0', 'uv_layout'); lay.setInput(0, flat)
    on = geo.evalParm('do_uv')
    for n in (seams, flat, lay): n.bypass(not on)
    out = geo.createNode('null', 'OUT'); out.setInput(0, lay)
    out.setDisplayFlag(True); out.setRenderFlag(True)
    rop = geo.createNode('rop_geometry', 'export_obj'); rop.setInput(0, out)
    rop.parm('sopoutput').setExpression('chs("../export_path")', hou.exprLanguage.Hscript)
    geo.layoutChildren()
    return geo, rop

def build_all(export=True, overrides=None):
    spec = json.load(open(SPEC))
    os.makedirs(EXPORT, exist_ok=True)
    made = {'kangs_body': build('kangs_body', spec['variants']['forward'], 0, overrides)}
    for i, (name, v) in enumerate(spec['variants'].items()):
        made['kangs_' + name] = build('kangs_' + name, v, 1.2 * (i + 1), overrides)
    if export:
        for name, (geo, rop) in made.items():
            if name != 'kangs_body':
                rop.render()
    hou.hipFile.save(ASSETS + '/houdini/kangs_players.hipnc')
    return made

if globals().get('KANGS_AUTORUN', True):
    RESULT = build_all()
