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
# The head is the variant's head block (body_shapes.json variants.<v>.head: shapes in absolute head-local metres, each
# with its own op and blend k, evaluated in list order; see 'head_about'); core = smin(body core, head, neck_k).
# The core is meshed twice from that one SDF: the body at the Voxel size and the head (above a seam plane just under the
# jaw) at the Head voxel size, so the nose bridge, ears and lip line survive. Each is reduced to its own budget and a
# strip of triangles zips the two open seam loops together, so the core stays one watertight mesh.
# scripts/build_players.py in the game repo reads the same body_shapes.json, adds the skeleton and skin weights and
# writes the glTF the game loads (Apprentice cannot export glTF or FBX itself).
import hou, json, os

ASSETS = '/Users/raghav/coding/kangs-assets'
SPEC = ASSETS + '/body_shapes.json'
EXPORT = ASSETS + '/houdini/export'
# Python SOP: one point per shape, carrying what the SDF needs (all in metres, scaled by the body's parameters).
SHAPES_SOP = r'''
import hou, json
node = hou.pwd(); geo = node.geometry(); body = node.parent()
H = body.evalParm('height_m'); SH = body.evalParm('shoulder'); M = body.evalParm('mass')
spec = json.load(open(body.evalParm('spec_path')))
for name, default in (('kind', 0), ('part', ''), ('r', (0.0, 0.0, 0.0)), ('basis', (0.0,) * 9), ('ra', 0.0), ('rb', 0.0), ('aspect', 1.0), ('len', 0.0), ('shape', ''),
                      ('op', 0), ('mirror', 0), ('k', 0.0), ('round', 0.0), ('amp', 0.0), ('taper', (0.0, 0.0))):
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
# head block: absolute head-local metres, placed at origin = (0, H - origin_from_top, origin_z); not scaled by H, SH or M.
# One point per shape in list order (the evaluation order), P = c + origin, so q = (X - P) * basis with X.x = |X.x| if mirror.
head = spec['variants'][body.evalParm('variant')]['head']
o = hou.Vector3(0, H - head['origin_from_top'], head['origin_z'])
kinds, ops = spec['head_kinds'], spec['head_ops']
geo.addAttrib(hou.attribType.Global, 'neck_k', float(head['neck_k']))
geo.addAttrib(hou.attribType.Global, 'head_origin', tuple(o))
geo.addAttrib(hou.attribType.Global, 'head_half_breadth', head['params']['breadth'] / 2000.0)
geo.addAttrib(hou.attribType.Global, 'head_start', len(geo.points()))
geo.addAttrib(hou.attribType.Global, 'head_count', len(head['shapes']))
for s in head['shapes']:
    pt = geo.createPoint()
    pt.setPosition(hou.Vector3(s['c']) + o)
    pt.setAttribValue('part', 'head'); pt.setAttribValue('shape', s['name'])
    pt.setAttribValue('kind', kinds.index(s['kind'])); pt.setAttribValue('op', ops.index(s['op'])); pt.setAttribValue('mirror', int(bool(s['mirror'])))
    pt.setAttribValue('k', float(s['k'])); pt.setAttribValue('r', [float(x) for x in s['r']]); pt.setAttribValue('basis', [float(x) for x in s['basis']])
    pt.setAttribValue('taper', [float(x) for x in s.get('taper', (0, 0))])
    for key in ('ra', 'rb', 'len', 'round', 'amp'): pt.setAttribValue(key, float(s.get(key, 0.0)))
    pt.setAttribValue('aspect', float(s.get('aspect', 1.0)))
'''

# Volume Wrangles. HEADER has the shape distance functions; each part / garment appends its own body.
# density = -distance, so every surface is the 0 iso.
HEADER = r"""
float smin(float a; float b; float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a; float b; float k) { return -smin(-a, -b, k); }
float roundcone(vector q; float r1; float r2; float h) {
    float b = (r1 - r2) / h; float a = sqrt(max(1.0 - b * b, 1e-6));
    vector2 w = set(length(set(q.x, q.z)), q.y);
    float k = dot(w, set(-b, a));
    if (k < 0.0) return length(w) - r1;
    if (k > a * h) return length(w - set(0.0, h)) - r2;
    return dot(w, set(a, b)) - r1;
}
float sdell(vector p; vector c; vector r) { vector q = p - c; float k0 = length(q / r); float k1 = length(q / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }
float sdroundbox(vector q; vector b; float rr) { vector w = abs(q) - b + rr; return length(max(w, set(0.0, 0.0, 0.0))) + min(max(w.x, max(w.y, w.z)), 0.0) - rr; }
// the head block (body_shapes.json 'head_about'): the head points in list order, each primitive combined into d by its op.
// noears = 1 leaves the ears out (the scalp that short hair and the headband grow from)
float head_sdf_x(vector P; int noears) {
    float d = 1e9;
    int i0 = detail(1, "head_start"); int n = detail(1, "head_count");
    for (int i = i0; i < i0 + n; i++) {
        if (noears && point(1, "shape", i) == "ear") continue;
        vector X = P;
        if (point(1, "mirror", i)) X.x = abs(X.x);
        matrix3 m = point(1, "basis", i);
        vector q = (X - point(1, "P", i)) * m;
        vector r = point(1, "r", i);
        vector2 tp = point(1, "taper", i);
        if (tp.x != 0.0 || tp.y != 0.0) q.x /= 1.0 + tp.x * clamp(q.z / r.z, -1.0, 1.0) + tp.y * clamp(q.y / r.y, -1.0, 1.0);
        int kind = point(1, "kind", i);
        float s;
        if (kind == 0) { float k0 = length(q / r); float k1 = length(q / (r * r)); s = k0 * (k0 - 1.0) / max(k1, 1e-6); }
        else if (kind == 1) { q.z /= point(1, "aspect", i); s = roundcone(q, point(1, "ra", i), point(1, "rb", i), max(point(1, "len", i), 1e-4)); }
        else if (kind == 2) s = sdroundbox(q, r, point(1, "round", i));
        else if (kind == 3) s = q.z;
        else s = point(1, "amp", i) * exp(-dot(q / r, q / r));
        int op = point(1, "op", i); float k = point(1, "k", i);
        if (op == 0) d = (i == i0) ? s : smin(d, s, k);
        else if (op == 1) d = smax(d, -s, k);
        else if (op == 2) d = smax(d, s, k);
        else d -= s;
    }
    return d;
}
float head_sdf(vector P) { return head_sdf_x(P, 0); }
// hairline (head-local): > 0 below it. The height runs round the head as a Catmull-Rom curve through keys (mm) every
// 22.5 deg of azimuth, 0 = forehead, 90 = in front of the ear (sideburn), 180 = nape
float hairline(vector L; float k[]) {
    int n = len(k);
    float t = clamp(degrees(atan2(abs(L.x), L.z - .005)) / 180.0, 0.0, 1.0) * (n - 1);
    int i = min(int(floor(t)), n - 2); float u = t - i;
    float p0 = k[i == 0 ? 1 : i - 1]; float p1 = k[i]; float p2 = k[i + 1]; float p3 = k[i + 2 > n - 1 ? n - 2 : i + 2];
    float h = 0.5 * (2.0 * p1 + (-p0 + p2) * u + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u * u + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * u * u * u);
    return h * .001 - L.y;
}
// afro hairline: a plane from yf at the forehead (z = +88 mm) sloping down the back at s
float hairplane(vector L; float yf; float s) { return (yf - s * (.088 - L.z)) - L.y; }
// hair cut away round both ears (head-local; the ears are 66 mm long, 24 mm proud, centred 14 mm behind the ear canal line)
float earcuts(float d0; vector L; float W; float t) {
    float d = d0;
    foreach (float sd; {-1.0, 1.0}) d = smax(d, -sdell(L, set(sd * (W + .004), 0.0, -.015), set(.026, .042, .03)), t);
    return d;
}
// smooth union of every body shape of one part (core, arm_L, arm_R) at point P (no head)
float body_sdf(string part; vector P; float blend) {
    float d = 1e9;
    int n = npoints(1);
    for (int i = 0; i < n; i++) {
        if (point(1, "part", i) != part) continue;
        vector c = point(1, "P", i);
        matrix3 m = point(1, "basis", i);
        vector q = (P - c) * m;
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
    return d;
}
// a part's SDF; the core is the body joined to the head block at the neck: smin(body core, head, neck_k)
float part_sdf(string part; vector P; float blend) {
    float d = body_sdf(part, P, blend);
    if (part == "core") d = smin(d, head_sdf(P), detail(1, "neck_k"));
    return d;
}
// the core without the ears: short hair and the headband are offsets of this, so they never wrap the thin ears
float scalp_sdf(vector P; float blend) { return smin(body_sdf("core", P, blend), head_sdf_x(P, 1), detail(1, "neck_k")); }
float H = ch("../height_m"); float SH = ch("../shoulder"); float B = max(ch("../blend"), 1e-4);
float SIDES[] = {-1.0, 1.0};
vector P = v@P;
vector HO = detail(1, "head_origin"); vector L = P - HO;   // head-local position (origin between the ear canals)
float HW = detail(1, "head_half_breadth");
"""

PART_VEX = 'f@surface = -part_sdf("PART", P, B);'

# Clothing and hair. Each is an offset of the body (so it fits every variant) cut to its region,
# with loose drape and folds where real ones hang. Sizes are fractions of height H, offsets in metres.
GARMENT_VEX = {
'jersey': r"""
float body = part_sdf("core", P, B);
vector q = P - set(0, .55 * H, .004 * H); q.z /= .64;
float drape = roundcone(q, .084 * H, .095 * H * pow(SH, .25), .2 * H);   // hangs straight from the chest, not tight at the waist
float d = smin(body - .007, drape, .02);
float ang = atan2(P.z, P.x);
// (no modelled fold ripples: they read as a dented, deformed jersey in the game; the fabric shader adds the texture)
d = smax(d, .545 * H - P.y, .004);
d = smax(d, P.y - .875 * H, .004);
foreach (float sd; SIDES)
    d = smax(d, -sdell(P, set(sd * .118 * H * SH, .762 * H, -.006 * H), set(.05 * H, .072 * H, .075 * H)), .006);   // deep arm holes
d = smax(d, -sdell(P, set(0, .835 * H, .03 * H), set(.048 * H, .06 * H, .06 * H)), .005);    // front neck scoop
d = smax(d, -sdell(P, set(0, .85 * H, -.035 * H), set(.045 * H, .035 * H, .05 * H)), .005);  // back neck
d = smax(d, -(body + .004), .002);   // hollow: a layer of fabric whose inner wall sits just inside the skin, so the openings cut cleanly
f@surface = -d;
""",
'shorts': r"""
float body = part_sdf("core", P, B);
float d = body - .012;
foreach (float sd; SIDES) {
    vector q = P - set(sd * .057 * H, .33 * H, .004 * H);
    d = smin(d, roundcone(q, .061 * H, .058 * H, .2 * H), .015);   // baggy legs, a touch wider at the hem
}
vector wq = P - set(0, .522 * H, .004 * H); wq.z /= .66;
d = smin(d, roundcone(wq, .088 * H, .09 * H * pow(SH, .25), .055 * H), .01);   // waistband sits over the tucked-in jersey
d = smax(d, -sdell(P, set(0, .325 * H, .004 * H), set(.011 * H, .13 * H, .2 * H)), .006);   // inseam: the legs part below the crotch
d = smax(d, .325 * H - P.y, .004);
d = smax(d, P.y - .578 * H, .004);
d -= .0018 * sin(atan2(P.z, P.x) * 18.0) * smooth(.53 * H, .57 * H, P.y);            // gathered waistband
d = smax(d, -(body + .004), .002);   // hollow, like the jersey: clean leg openings
f@surface = -d;
""",
'shoes': r"""
float d = 1e9;
foreach (float sd; SIDES) {
    vector a = set(sd * .045 * H, .026 * H, -.022 * H);
    vector q = P - a; vector qq = set(q.x, q.z, q.y / .72);   // capsule along +z, flattened in y
    float foot = roundcone(qq, .028 * H, .024 * H, .132 * H);
    float collar = roundcone(P - set(sd * .044 * H, .02 * H, -.01 * H), .033 * H, .029 * H, .06 * H);   // high-top collar round the ankle
    d = smin(d, smin(foot, collar, .02), .001);
}
d = smax(d, -P.y, .002);   // flat sole on the floor
f@surface = -d;
""",
'hair_buzz': r"""
float d = scalp_sdf(P, B) - .0035;
d = smax(d, hairline(L, {90.0, 88.0, 80.0, 52.0, 6.0, 0.0, -16.0, -32.0, -38.0}), .003);   // forehead +90, sideburn, nape -38 (mm)
d = earcuts(d, L, HW, .003);
f@surface = -d;
""",
'hair_crop': r"""
float t = .004 + .011 * smooth(-.005, .105, L.y);   // thin at the sides, fuller on top (head-local heights)
float d = scalp_sdf(P, B) - t;
d = smax(d, hairline(L, {93.0, 91.0, 83.0, 55.0, 8.0, 2.0, -14.0, -30.0, -36.0}), .004);
d = earcuts(d, L, HW, .003);
f@surface = -d;
""",
'hair_afro': r"""
float head = part_sdf("core", P, B);
float d = smin(head - .022, sdell(L, set(0, .058, -.014), set(HW + .0675, .125, .145)), .035);
d -= .0008 * sin(L.x * 420.0) * sin(L.y * 400.0) * sin(L.z * 440.0);   // a little curl texture (fine curl comes from the hair material)
d = smax(d, hairplane(L, .087, .70), .008);   // covers the tops of the ears
f@surface = -d;
""",
'hair_rows': r"""
float ridge = max(0.0, sin(L.x / .036 * 3.14159));
float d = scalp_sdf(P, B) - (.0035 + .0045 * ridge);   // cornrows running front to back
d = smax(d, hairline(L, {91.0, 89.0, 81.0, 53.0, 7.0, 1.0, -15.0, -31.0, -37.0}), .003);
d = earcuts(d, L, HW, .003);
f@surface = -d;
""",
'headband': r"""
float d = scalp_sdf(P, B) - .007;
float lo = .044 + .15 * L.z;   // head-local: across the forehead at +60..+88 mm, above the ears, a little lower at the back
d = smax(d, lo - L.y, .002);
d = smax(d, L.y - (lo + .028), .002);
f@surface = -d;
""",
'sleeve_arm': r"""
float d = part_sdf("arm_R", P, B) - .0035;
d = smax(d, .505 * H - P.y, .003);
d = smax(d, P.y - .745 * H, .003);
f@surface = -d;
""",
'sleeve_leg': r"""
float d = part_sdf("core", P, B) - .0035;
d = smax(d, .105 * H - P.y, .003);
d = smax(d, P.y - .315 * H, .003);
d = smax(d, .015 * H - P.x, .002);   // left leg only
f@surface = -d;
""",
}

# Volume box per piece: centre and size as fractions of height, whether x follows the shoulder factor,
# voxel scale (x the Voxel size parameter) and triangle budget.
BOX = {'core': ((0, .5, .02), (.34, 1.04, .26), False, 1.0, 'target_core'),
       'arm_L': ((.123, .61, .005), (.11, .5, .12), True, 1.0, 'target_arm'),
       'arm_R': ((-.123, .61, .005), (.11, .5, .12), True, 1.0, 'target_arm'),
       'jersey': ((0, .71, .005), (.32, .36, .26), True, .75, 3000),   # hollow: half of it is the hidden inner wall
       'shorts': ((0, .45, .005), (.3, .28, .24), False, .75, 2600),
       'shoes': ((0, .05, .045), (.2, .11, .25), False, .8, 900),
       'sleeve_arm': ((-.123, .625, .005), (.1, .27, .11), True, .8, 350),
       'sleeve_leg': ((.05, .21, 0), (.1, .23, .1), False, .8, 350)}
# Head-local volume boxes (metres from the head origin; they move with Height but do not scale with it):
# centre, size, voxel scale (x the Voxel size parameter, or the Head voxel size for 'head'), triangle budget.
HEAD_BOX = {'head': ((0, .005, .0125), (.24, .30, .255), 1.0, 'target_head'),   # the core above the neck seam, meshed fine
            'hair_buzz': ((0, .05, 0), (.22, .22, .24), .7, 600),
            'hair_crop': ((0, .05, 0), (.22, .22, .24), .7, 700),
            'hair_afro': ((0, .068, -.018), (.33, .27, .32), .6, 1400),
            'hair_rows': ((0, .05, 0), (.22, .22, .24), .6, 900),
            'headband': ((0, .06, .005), (.22, .1, .24), .6, 250)}
# Neck seam (head-local): the plane y = SEAM_Y - SEAM_T * z, just under the jaw and chin, above the shoulders. The head mesh
# keeps what is above it, the body mesh what is SEAM_GAP (along the plane normal) below it; a zipper strip fills the gap.
SEAM_Y, SEAM_T, SEAM_GAP = -.085, .3, .004
TARGET_CORE, TARGET_HEAD = 4000, 1600   # body below the seam, head above it (whole-player cap: 15k triangles in the game)
PARTS = ('core', 'arm_L', 'arm_R')
PIECES = PARTS + tuple(GARMENT_VEX)

# Python SOP on the merged body + head core meshes (input 1: the shapes, for the head origin): zips the two open seam
# loops together with one strip of triangles, wound to match the mesh, so the core is one closed, watertight surface.
SEAM_SOP = r"""
import hou, math
node = hou.pwd(); geo = node.geometry()
o = hou.Vector3(node.inputs()[1].geometry().attribValue('head_origin'))
SEAM_Y, SEAM_T = %r, %r
n = hou.Vector3(0, 1, SEAM_T).normalized(); e1 = hou.Vector3(1, 0, 0); e2 = hou.Vector3(0, -SEAM_T, 1).normalized()
c0 = o + hou.Vector3(0, SEAM_Y, 0)
pos = [p.position() for p in geo.points()]
uses, directed = {}, set()
for pr in geo.prims():
    vs = [v.point().number() for v in pr.vertices()]
    for i in range(len(vs)):
        a, b = vs[i], vs[(i + 1) %% len(vs)]
        directed.add((a, b)); key = (min(a, b), max(a, b)); uses[key] = uses.get(key, 0) + 1
nbr = {}
for (a, b), cnt in uses.items():
    if cnt == 1: nbr.setdefault(a, []).append(b); nbr.setdefault(b, []).append(a)
loops, seen = [], set()
for s in sorted(nbr):
    if s in seen: continue
    loop, prev, cur = [s], None, s; seen.add(s)
    while True:
        if len(nbr[cur]) != 2: raise hou.NodeError('neck seam: boundary point %%d has %%d boundary edges' %% (cur, len(nbr[cur])))
        nxt = [q for q in nbr[cur] if q != prev][0]
        if nxt == s: break
        if nxt in seen: raise hou.NodeError('neck seam: tangled boundary at point %%d' %% nxt)
        loop.append(nxt); seen.add(nxt); prev, cur = cur, nxt
    loops.append(loop)
if len(loops) != 2: raise hou.NodeError('neck seam: expected 2 open loops (head and body), found %%d' %% len(loops))
loops.sort(key=lambda lp: -sum((pos[i] - c0).dot(n) for i in lp) / len(lp))   # head loop (above the seam) first
c = hou.Vector3(0, 0, 0)
for lp in loops:
    for i in lp: c += pos[i]
c /= sum(len(lp) for lp in loops)
def ordered(lp):
    ang = [math.atan2((pos[i] - c).dot(e1), (pos[i] - c).dot(e2)) for i in lp]
    wrap = lambda x: (x + math.pi) %% (2 * math.pi) - math.pi
    if sum(wrap(ang[(k + 1) %% len(lp)] - ang[k]) for k in range(len(lp))) < 0: lp = lp[::-1]; ang = ang[::-1]
    k0 = min(range(len(lp)), key=lambda k: ang[k]); lp = lp[k0:] + lp[:k0]; ang = ang[k0:] + ang[:k0]
    th = [ang[0]]
    for k in range(1, len(lp)): th.append(th[-1] + wrap(ang[k] - ang[k - 1]))
    return lp, th + [th[0] + 2 * math.pi]
(A, tA), (B, tB) = ordered(loops[0]), ordered(loops[1])
na, nb = len(A), len(B); i = j = 0; tris = []
while i < na or j < nb:
    if j >= nb or (i < na and tA[i + 1] <= tB[j + 1]): tris.append((A[i], A[(i + 1) %% na], B[j %% nb])); i += 1
    else: tris.append((B[j], B[(j + 1) %% nb], A[i %% na])); j += 1
seam = geo.createPrimGroup('neck_seam')
pts = geo.points()
for a, b, x in tris:
    order = (b, a, x) if (a, b) in directed else (a, b, x)   # traverse the shared boundary edge against its neighbour
    pr = geo.createPolygon()
    for q in order: pr.addVertex(pts[q])
    seam.add(pr)
head = geo.findPrimGroup('head_part')
geo.addAttrib(hou.attribType.Global, 'head_tris', len(head.prims()) if head else 0)
geo.addAttrib(hou.attribType.Global, 'seam_tris', len(tris))
geo.addAttrib(hou.attribType.Global, 'seam_loops', (na, nb))
if head: head.destroy()
seam.destroy()
# watertight check: every edge now shared by exactly two polygons, once in each direction (consistent winding)
uses, dirs = {}, {}
for pr in geo.prims():
    vs = [v.point().number() for v in pr.vertices()]
    for k in range(len(vs)):
        a, b = vs[k], vs[(k + 1) %% len(vs)]
        key = (min(a, b), max(a, b)); uses[key] = uses.get(key, 0) + 1; dirs[(a, b)] = dirs.get((a, b), 0) + 1
geo.addAttrib(hou.attribType.Global, 'open_edges', sum(1 for v in uses.values() if v != 2))
geo.addAttrib(hou.attribType.Global, 'flipped_edges', sum(1 for v in dirs.values() if v > 1))
""" % (SEAM_Y, SEAM_T)

# Python SOP after triangulating the core. Polyreduce can fold the narrow crevice in front of an ear root:
#  * a self-folded polygon triangulates into a back-to-back pair of identical triangles (a zero-area fin): delete the pair;
#  * two surface sheets collapse onto one shared edge/point (an edge with four triangles, a "pinch"): give each sheet its own
#    copy of the pinched points (same position), so the sheets just touch and every edge has exactly two triangles again.
# Then re-check that every edge has exactly two triangles.
CLEAN_SOP = r'''
import hou
geo = hou.pwd().geometry()
same = {}
for pr in geo.prims():
    same.setdefault(tuple(sorted(v.point().number() for v in pr.vertices())), []).append(pr)
fins = [p for ps in same.values() if len(ps) > 1 for p in ps]
if fins: geo.deletePrims(fins, keep_points=False)
tris = [[v.point().number() for v in pr.vertices()] for pr in geo.prims()]
count = {}
for t in tris:
    for k in range(3):
        e = (min(t[k], t[k - 1]), max(t[k], t[k - 1])); count[e] = count.get(e, 0) + 1
fan = {}
for ti, t in enumerate(tris):
    for v in t: fan.setdefault(v, []).append(ti)
split, new_tris = 0, [list(t) for t in tris]
for v, faces in fan.items():
    if not any(count[(min(v, w), max(v, w))] != 2 for ti in faces for w in tris[ti] if w != v): continue
    parent = {ti: ti for ti in faces}
    def root(x):
        while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
        return x
    by_edge = {}
    for ti in faces:
        for w in tris[ti]:
            if w != v and count[(min(v, w), max(v, w))] == 2: by_edge.setdefault(w, []).append(ti)
    for pair in by_edge.values():
        if len(pair) == 2: parent[root(pair[0])] = root(pair[1])
    comps = {}
    for ti in faces: comps.setdefault(root(ti), []).append(ti)
    for comp in list(comps.values())[1:]:   # every extra fan gets its own copy of the point
        q = geo.createPoint(); q.setPosition(geo.point(v).position()); split += 1
        for ti in comp: new_tris[ti] = [q.number() if x == v else x for x in new_tris[ti]]
if split:
    old = list(geo.prims()); pts = geo.points()
    for t in new_tris:
        pr = geo.createPolygon()
        for x in t: pr.addVertex(pts[x])
    geo.deletePrims(old, keep_points=True)
uses = {}
for pr in geo.prims():
    vs = [v.point().number() for v in pr.vertices()]
    for k in range(len(vs)):
        key = (min(vs[k], vs[(k + 1) % len(vs)]), max(vs[k], vs[(k + 1) % len(vs)])); uses[key] = uses.get(key, 0) + 1
geo.addAttrib(hou.attribType.Global, 'fin_tris_removed', len(fins))
geo.addAttrib(hou.attribType.Global, 'pinched_points_split', split)
geo.addAttrib(hou.attribType.Global, 'core_bad_edges', sum(1 for n in uses.values() if n != 2))
'''

SDF_NORMAL_VEX = '''
float e = .0005;
v@N = normalize(set(part_sdf("core", P + set(e, 0, 0), B) - part_sdf("core", P - set(e, 0, 0), B),
                    part_sdf("core", P + set(0, e, 0), B) - part_sdf("core", P - set(0, e, 0), B),
                    part_sdf("core", P + set(0, 0, e), B) - part_sdf("core", P - set(0, 0, e), B)));
'''

def add_parms(geo, v, variant):
    ptg = geo.parmTemplateGroup()
    f = hou.FolderParmTemplate('kangs', 'Kangs body')
    f.addParmTemplate(hou.StringParmTemplate('variant', 'Head variant', 1, default_value=(variant,), menu_items=('guard', 'forward', 'center')))
    f.addParmTemplate(hou.FloatParmTemplate('height_m', 'Height (m)', 1, default_value=(v['height_m'],), min=1.6, max=2.4))
    f.addParmTemplate(hou.FloatParmTemplate('shoulder', 'Shoulder width', 1, default_value=(v['shoulder'],), min=0.8, max=1.25))
    f.addParmTemplate(hou.FloatParmTemplate('mass', 'Muscle mass', 1, default_value=(v['mass'],), min=0.7, max=1.4))
    f.addParmTemplate(hou.FloatParmTemplate('blend', 'Blend radius (m)', 1, default_value=(0.03,), min=0.001, max=0.08))
    f.addParmTemplate(hou.FloatParmTemplate('voxel', 'Voxel size (m)', 1, default_value=(0.006,), min=0.003, max=0.02))
    f.addParmTemplate(hou.FloatParmTemplate('head_voxel', 'Head voxel size (m)', 1, default_value=(0.0025,), min=0.001, max=0.01))
    f.addParmTemplate(hou.IntParmTemplate('target_core', 'Triangles: body', 1, default_value=(TARGET_CORE,), min=1000, max=40000))
    f.addParmTemplate(hou.IntParmTemplate('target_head', 'Triangles: head', 1, default_value=(TARGET_HEAD,), min=300, max=20000))
    f.addParmTemplate(hou.IntParmTemplate('target_arm', 'Triangles: each arm', 1, default_value=(900,), min=200, max=8000))
    f.addParmTemplate(hou.FloatParmTemplate('garment_detail', 'Clothing/hair detail', 1, default_value=(1.0,), min=0.3, max=4.0))
    f.addParmTemplate(hou.ToggleParmTemplate('do_uv', 'Unwrap UVs', default_value=True))
    f.addParmTemplate(hou.StringParmTemplate('spec_path', 'Shape table', 1, default_value=(SPEC,), string_type=hou.stringParmType.FileReference))
    f.addParmTemplate(hou.StringParmTemplate('export_path', 'Export OBJ', 1, default_value=(EXPORT + '/' + geo.name() + '.obj',), string_type=hou.stringParmType.FileReference))
    ptg.append(f)
    geo.setParmTemplateGroup(ptg)

def piece(geo, shapes, part, v):
    """Volume box -> SDF wrangle -> mesh -> (clip at the neck seam for the core and head) -> reduce. Returns the last node."""
    vol = geo.createNode('volume', 'box_' + part)
    vol.parm('name').set('surface')
    if part in HEAD_BOX:   # head-local box: follows the head origin (H - origin_from_top, origin_z), not scaled by H
        (cx, cy, cz), (sx, sy, sz), vscale, budget = HEAD_BOX[part]
        top, hz = v['head']['origin_from_top'], v['head']['origin_z']
        vol.parm('tx').set(cx); vol.parm('ty').setExpression('ch("../height_m")-%f+%f' % (top, cy)); vol.parm('tz').set(hz + cz)
        for axis, size in (('x', sx), ('y', sy), ('z', sz)): vol.parm('size' + axis).set(size)
        vox = 'head_voxel' if part == 'head' else 'voxel'
    else:
        (cx, cy, cz), (sx, sy, sz), side, vscale, budget = BOX[part]
        sh = '*ch("../shoulder")' if side else ''
        for axis, val, size in (('x', cx, sx), ('y', cy, sy), ('z', cz, sz)):
            vol.parm('t' + axis).setExpression('%f*ch("../height_m")%s' % (val, sh if axis == 'x' else ''))
            vol.parm('size' + axis).setExpression('%f*ch("../height_m")%s' % (size, sh if axis == 'x' else ''))
        vox = 'voxel'
    vol.parm('uniformsamples').set('size'); vol.parm('divsize').setExpression('ch("../%s")*%f' % (vox, vscale))
    wr = geo.createNode('volumewrangle', 'sdf_' + part); wr.setInput(0, vol); wr.setInput(1, shapes)
    sdf_part = 'core' if part == 'head' else part
    wr.parm('snippet').set(HEADER + (PART_VEX.replace('PART', sdf_part) if sdf_part in PARTS else GARMENT_VEX[part]))
    mesh = geo.createNode('convertvolume', 'mesh_' + part); mesh.setInput(0, wr); mesh.parm('iso').set(0)
    last = mesh
    if part in ('core', 'head'):   # cut at the neck seam plane: the head keeps what is above it, the body what is below
        top, hz = v['head']['origin_from_top'], v['head']['origin_z']
        clip = geo.createNode('clip', 'seam_clip_' + part); clip.setInput(0, mesh)
        clip.parm('clipop').set('above' if part == 'head' else 'below')
        clip.parm('originx').set(0); clip.parm('originy').setExpression('ch("../height_m")-%f+%f' % (top, SEAM_Y)); clip.parm('originz').set(hz)
        clip.parmTuple('dir').set((0, 1, SEAM_T))
        clip.parm('dist').set(0 if part == 'head' else -SEAM_GAP)
        last = clip
    red = geo.createNode('polyreduce::2.0', 'reduce_' + part); red.setInput(0, last)
    red.parm('target').set('poly_count')
    if part in ('core', 'head'): red.parm('boundaryweight').set(5.0)   # keep enough points on the seam loops for a round neck
    red.parm('finalcount').setExpression('ch("../%s")' % budget if isinstance(budget, str) else 'int(%d*ch("../garment_detail"))' % budget)
    return red

def build(name, v, tx=0.0, overrides=None, variant=None):
    obj = hou.node('/obj')
    old = obj.node(name)
    if old: old.destroy()
    geo = obj.createNode('geo', name)
    geo.parmTuple('t').set((tx, 0, 0))
    add_parms(geo, v, variant or name.replace('kangs_', ''))
    for k, val in (overrides or {}).items():
        geo.parm(k).set(val)
    shapes = geo.createNode('python', 'shapes'); shapes.parm('python').set(SHAPES_SOP)
    merge = geo.createNode('merge', 'body')
    for part in PIECES:
        red = piece(geo, shapes, part, v)
        if part == 'core':   # body (coarse) + head (fine), zipped at the neck seam into one closed core mesh
            head = piece(geo, shapes, 'head', v)
            hgrp = geo.createNode('groupcreate', 'group_head_part'); hgrp.setInput(0, head); hgrp.parm('groupname').set('head_part')
            both = geo.createNode('merge', 'core_parts'); both.setNextInput(red); both.setNextInput(hgrp)
            red = geo.createNode('python', 'neck_seam'); red.setInput(0, both); red.setInput(1, shapes); red.parm('python').set(SEAM_SOP)
            tri = geo.createNode('divide', 'triangulate_core'); tri.setInput(0, red); tri.parm('convex').set(1); tri.parm('numsides').set(3)
            red = geo.createNode('python', 'clean_core'); red.setInput(0, tri); red.parm('python').set(CLEAN_SOP)
            # skin normals from the SDF gradient (not from the reduced facets), so the low-poly face shades like the real surface
            sn = geo.createNode('attribwrangle', 'sdf_normals_core'); sn.setInput(0, red); sn.setInput(1, shapes); sn.parm('class').set(3)
            sn.parm('snippet').set(HEADER + SDF_NORMAL_VEX); red = sn
        grp = geo.createNode('groupcreate', 'group_' + part); grp.setInput(0, red); grp.parm('groupname').set(part)
        merge.setNextInput(grp)
    nrm = geo.createNode('normal', 'smooth_normals'); nrm.setInput(0, merge); nrm.parm('type').set('typevertex'); nrm.parm('cuspangle').set(60)  # smooth skin, crisp hems and cuffs
    nrm.parm('group').set('* ^core')   # the core keeps its SDF normals
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

def sample_sdf(geo, points):
    """Parity check: head_sdf and the core part_sdf at body-space points (list of xyz), evaluated by the same HEADER VEX
    the volumes use. Returns [(head, core)]; compare with preview_body.head_sdf / core_sdf."""
    src = geo.createNode('python', '_sdf_points')
    src.parm('python').set('import hou\ngeo = hou.pwd().geometry()\nfor p in %r: geo.createPoint().setPosition(p)\n' % [tuple(map(float, p)) for p in points])
    wr = geo.createNode('attribwrangle', '_sdf_sample'); wr.setInput(0, src); wr.setInput(1, geo.node('shapes'))
    wr.parm('snippet').set(HEADER + 'f@head = head_sdf(P); f@core = part_sdf("core", P, B);')
    g = wr.geometry()
    out = list(zip(g.pointFloatAttribValues('head'), g.pointFloatAttribValues('core')))
    wr.destroy(); src.destroy()
    return out

def build_all(export=True, overrides=None):
    spec = json.load(open(SPEC))
    os.makedirs(EXPORT, exist_ok=True)
    made = {'kangs_body': build('kangs_body', spec['variants']['forward'], 0, overrides, 'forward')}
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
