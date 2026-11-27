import bpy, math, sys, json, os, array
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view as w2c

a = sys.argv[sys.argv.index('--') + 1:]
which, samples, pct = a[0], int(a[1]), int(a[2])
W = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = samples
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 8
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.view_settings.exposure = {'score': .8, 'laptop': .6, 'monitor': .55}[which]


# ---------- 재질
def mat(n, col=(.8, .8, .8), rough=.5, metal=0, **k):
    m = bpy.data.materials.new(n); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    for kk, v in k.items(): b.inputs[kk.replace('_', ' ')].default_value = v
    return m


def bump(m, scale, strength, dist=.001):
    t = m.node_tree; n = t.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = 6
    c = t.nodes.new('ShaderNodeTexCoord'); b = t.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = strength; b.inputs['Distance'].default_value = dist
    t.links.new(c.outputs['Object'], n.inputs['Vector'])
    t.links.new(n.outputs['Fac'], b.inputs['Height'])
    t.links.new(b.outputs['Normal'], t.nodes['Principled BSDF'].inputs['Normal'])


def img(m, f, emit=0):
    t = m.node_tree; i = t.nodes.new('ShaderNodeTexImage'); i.image = bpy.data.images.load(f)
    p = t.nodes['Principled BSDF']
    if emit:
        p.inputs['Base Color'].default_value = (.01, .01, .01, 1)
        t.links.new(i.outputs['Color'], p.inputs['Emission Color'])
        p.inputs['Emission Strength'].default_value = emit
    else:
        t.links.new(i.outputs['Color'], p.inputs['Base Color'])


def wood():
    m = mat('wood', rough=.42); t = m.node_tree; L = t.links.new; p = t.nodes['Principled BSDF']
    c = t.nodes.new('ShaderNodeTexCoord')
    mp = t.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.3, 14, 14)
    n = t.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = 2.2; n.inputs['Detail'].default_value = 10
    n.inputs['Roughness'].default_value = .62; n.inputs['Distortion'].default_value = .7
    r = t.nodes.new('ShaderNodeValToRGB'); e = r.color_ramp.elements
    e[0].position = .3; e[0].color = (.13, .06, .027, 1)
    e[1].position = .72; e[1].color = (.42, .235, .12, 1)
    e.new(.5).color = (.28, .145, .07, 1)
    mp2 = t.nodes.new('ShaderNodeMapping'); mp2.inputs['Scale'].default_value = (6, 220, 220)
    f = t.nodes.new('ShaderNodeTexNoise'); f.inputs['Scale'].default_value = 3; f.inputs['Detail'].default_value = 4
    r2 = t.nodes.new('ShaderNodeValToRGB')
    r2.color_ramp.elements[0].position = .35; r2.color_ramp.elements[0].color = (.45, .4, .36, 1)
    r2.color_ramp.elements[1].position = .6
    mx = t.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
    mx.inputs[0].default_value = .55
    L(c.outputs['Object'], mp.inputs[0]); L(mp.outputs[0], n.inputs[0]); L(n.outputs['Fac'], r.inputs[0])
    L(c.outputs['Object'], mp2.inputs[0]); L(mp2.outputs[0], f.inputs[0]); L(f.outputs['Fac'], r2.inputs[0])
    L(r.outputs[0], mx.inputs[6]); L(r2.outputs[0], mx.inputs[7]); L(mx.outputs[2], p.inputs['Base Color'])
    b = t.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = .18; b.inputs['Distance'].default_value = .002
    L(f.outputs['Fac'], b.inputs['Height']); L(b.outputs[0], p.inputs['Normal'])
    return m


# ---------- 모양
def put(o, m):
    o.data.materials.clear(); o.data.materials.append(m); return o


def smooth(o):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=.6); o.select_set(False)


def box(n, size, loc, m, bev=0, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.object; o.name = n
    o.scale = size; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.location = loc; o.rotation_euler = rot; o.parent = parent
    if bev:
        b = o.modifiers.new('b', 'BEVEL'); b.width = bev; b.segments = 4; smooth(o)
    return put(o, m)


def slab(n, w, d, h, r, loc, m, parent=None, rot=(0, 0, 0), bev=.001):
    vs = []
    for cx, cy, a0 in ((w/2-r, d/2-r, 0), (-w/2+r, d/2-r, 90), (-w/2+r, -d/2+r, 180), (w/2-r, -d/2+r, 270)):
        for k in range(9):
            t = math.radians(a0 + k*90/8); vs.append((cx + r*math.cos(t), cy + r*math.sin(t)))
    N = len(vs)
    V = [(x, y, -h/2) for x, y in vs] + [(x, y, h/2) for x, y in vs]
    F = [tuple(range(N-1, -1, -1)), tuple(range(N, 2*N))] + [(i, (i+1) % N, N+(i+1) % N, N+i) for i in range(N)]
    me = bpy.data.meshes.new(n); me.from_pydata(V, [], F)
    o = bpy.data.objects.new(n, me); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = rot; o.parent = parent; put(o, m)
    if bev:
        b = o.modifiers.new('b', 'BEVEL'); b.width = bev; b.segments = 3; b.limit_method = 'ANGLE'
    smooth(o); return o


def plane(n, w, h, m, loc, rot, parent=None):
    bpy.ops.mesh.primitive_plane_add(size=1); o = bpy.context.object; o.name = n
    o.scale = (w, h, 1); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.location = loc; o.rotation_euler = rot; o.parent = parent; return put(o, m)


def cyl(r, h, loc, m, bev=0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=96, location=loc); o = bpy.context.object
    if bev:
        b = o.modifiers.new('b', 'BEVEL'); b.width = bev; b.segments = 4; b.limit_method = 'ANGLE'
    smooth(o); return put(o, m)


def mug(x, y):
    c = mat('ceramic', (.82, .8, .76), .18, Coat_Weight=.5)
    cyl(.04, .09, (x, y, .045), c, .004)
    cyl(.036, .004, (x, y, .0895), mat('coffee', (.035, .014, .006), .06))
    for kw in (dict(major_radius=.025, minor_radius=.0055, location=(x+.045, y, .047), rotation=(math.pi/2, 0, 0)),
               dict(major_radius=.038, minor_radius=.0022, location=(x, y, .09))):
        bpy.ops.mesh.primitive_torus_add(major_segments=80, **kw); bpy.ops.object.shade_smooth(); put(bpy.context.object, c)


def area(loc, tgt, size, power, col):
    l = bpy.data.lights.new('a', 'AREA'); l.energy = power; l.color = col; l.size = size
    o = bpy.data.objects.new('a', l); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


def cam(loc, tgt, lens, f, focus, rx, ry):
    c = bpy.data.cameras.new('c'); o = bpy.data.objects.new('c', c); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    c.lens = lens; c.dof.use_dof = True; c.dof.aperture_fstop = f
    c.dof.focus_distance = (Vector(focus) - Vector(loc)).length
    c.clip_start = .01
    sc.camera = o; sc.render.resolution_x = rx; sc.render.resolution_y = ry; sc.render.resolution_percentage = pct


def world(col, s):
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    b = w.node_tree.nodes['Background']; b.inputs[0].default_value = (*col, 1); b.inputs[1].default_value = s


def empty(loc, rot, parent=None):
    o = bpy.data.objects.new('e', None); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = rot; o.parent = parent; return o


def desk(): plane('desk', 4, 2.4, wood(), (0, 0, 0), (0, 0, 0))


def wall(y):
    m = mat('wall', (.62, .58, .53), .9); bump(m, 60, .25); plane('wall', 6, 4, m, (0, y, 1.5), (math.pi/2, 0, 0))


out = {}


def quad(o, w, h):
    bpy.context.view_layer.update()
    return [[round(p.x*100, 3), round((1-p.y)*100, 3)] for p in
            (w2c(sc, sc.camera, o.matrix_world @ Vector(v)) for v in
             ((-w/2, h/2, 0), (w/2, h/2, 0), (w/2, -h/2, 0), (-w/2, -h/2, 0)))]


if which == 'score':
    world((.75, .85, 1), .28); desk()
    pw, ph, nx, ny = .21, .297, 70, 100
    V, F, UV = [], [], []
    for j in range(ny+1):
        for i in range(nx+1):
            u, v = i/nx, j/ny
            z = .0025 + .0008*math.sin(u*5+v*3) + .0006*math.sin(v*9)
            d = max(0, u+(1-v)*.9-1.45); z += .06*d*d
            d2 = max(0, (1-u)+v*.8-1.5); z += .06*d2*d2
            V.append(((u-.5)*pw, (v-.5)*ph, z)); UV.append((u, v))
    for j in range(ny):
        for i in range(nx):
            k = j*(nx+1)+i; F.append((k, k+1, k+nx+2, k+nx+1))
    me = bpy.data.meshes.new('p'); me.from_pydata(V, [], F); ul = me.uv_layers.new()
    for l in me.loops: ul.data[l.index].uv = UV[l.vertex_index]
    m = mat('paper', rough=.85); img(m, W+'/score.png'); bump(m, 900, .12, .0004)
    me.materials.append(m); me.polygons.foreach_set('use_smooth', [True]*len(me.polygons))
    o = bpy.data.objects.new('p', me); sc.collection.objects.link(o); o.rotation_euler = (0, 0, .12)
    plane('under', pw, ph, mat('under', (.86, .83, .76), .9), (.012, -.006, .0006), (0, 0, .04))
    e = empty((.139, .005, .0046), (0, 0, 1.2))

    def rod(r1, r2, d, x, m, v=32):
        bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=d, vertices=v, location=(x, 0, 0), rotation=(0, math.pi/2, 0))
        o = bpy.context.object; o.parent = e; put(o, m)
    rod(.0042, .0042, .135, 0, mat('pen', (.02, .055, .12), .22, Coat_Weight=.8), 6)
    rod(.0041, .0009, .018, .0765, mat('rawwood', (.6, .38, .2), .8))
    rod(.0011, .0002, .005, .087, mat('lead', (.02, .02, .02), .4))
    rod(.0043, .0043, .013, -.073, mat('brass', (.75, .55, .25), .28, 1))
    mug(-.155, .13)
    area((-.9, .75, .75), (0, 0, 0), .28, 17, (1, .83, .62)); area((.6, -.5, .9), (0, 0, 0), 1, 3, (.75, .86, 1))
    cam((.035, -.235, .265), (.008, .035, 0), 50, 9, (0, .05, 0), 880, 660)

elif which == 'laptop':
    world((.8, .88, 1), .3); desk(); wall(.75)
    al = mat('al', (.6, .61, .63), .32, 1); bump(al, 2500, .06, .0002)
    dk = mat('key', (.018, .018, .02), .5); bl = mat('bezel', (.006, .006, .007), .12)
    r = empty((0, 0, 0), (0, 0, -.16)); w, d = .304, .212
    slab('base', w, d, .0105, .012, (0, 0, .0075), al, r, bev=.0018)
    slab('well', .268, .105, .0006, .003, (0, .026, .0128), mat('well', (.03, .03, .032), .6), r, bev=0)
    for row, n in enumerate([14, 14, 13, 12, 9]):
        xs = .264/n
        for k in range(n):
            slab('k', xs-.0026, .0165, .0012, .0018, (-.132+xs*(k+.5), .0675-row*.0204, .0136), dk, r, bev=.0004)
    slab('pad', .118, .066, .0005, .004, (0, -.066, .0128), mat('pad', (.54, .55, .57), .25, 1), r, bev=0)
    h = empty((0, d/2-.003, .013), (math.radians(-16), 0, 0), r)
    slab('lid', w, .205, .005, .012, (0, .004, .1025), al, h, (math.pi/2, 0, 0))
    slab('bez', w-.004, .2, .0008, .01, (0, .0012, .1025), bl, h, (math.pi/2, 0, 0), 0)
    sw, sh = .288, .18; sm = mat('scr', rough=.15); img(sm, W+'/ui.png', .95)
    s = plane('s', sw, sh, sm, (0, .0007, .106), (math.pi/2, 0, 0), h)
    mug(.225, .07)
    nb = mat('note', (.055, .085, .12), .65); bump(nb, 600, .3, .0006)
    box('nb', (.13, .19, .014), (-.25, 0, .007), nb, .003, (0, 0, .15))
    area((-1, .3, .8), (0, 0, .1), .5, 17, (1, .85, .68)); area((.8, -.7, .9), (0, 0, .1), 1, 5, (.78, .87, 1))
    cam((.05, -.47, .225), (.005, .07, .105), 54, 8, (0, .1, .1), 880, 660)
    out['quad'] = quad(s, sw, sh); out['aspect'] = [1600, 1000]

else:
    world((.8, .88, 1), .22); desk(); wall(.55)
    bl = mat('bez', (.008, .008, .009), .2); st = mat('st', (.5, .51, .53), .3, 1); bump(st, 2500, .06, .0002)
    r = empty((0, .12, 0), (0, 0, .1))
    slab('foot', .2, .15, .006, .02, (0, .02, .003), st, r); box('neck', (.045, .012, .2), (0, .045, .1), st, .004, (.06, 0, 0), r)
    slab('body', .56, .332, .016, .008, (0, .012, .255), bl, r, (math.pi/2, 0, 0))
    sw, sh = .544, .306; sm = mat('scr', rough=.18); img(sm, W+'/sea.png', .9)
    s = plane('s', sw, sh, sm, (0, .0035, .255), (math.pi/2, 0, 0), r)
    kb = mat('kb', (.75, .75, .76), .4); km = mat('kk', (.86, .86, .86), .5)
    slab('kb', .3, .1, .008, .01, (-.02, -.14, .005), kb)
    for row in range(5):
        for k in range(15): slab('k', .0165, .0155, .003, .002, (-.157+k*.0196, -.102-row*.0187, .0105), km, bev=.0006)
    slab('mouse', .058, .1, .02, .027, (.2, -.14, .011), kb, bev=.009)
    mug(-.34, .03)
    area((-1.1, .1, .9), (0, .1, .15), .5, 16, (1, .82, .62)); area((.9, -.8, 1), (0, 0, .1), 1.2, 5, (.78, .87, 1))
    cam((-.05, -1.0, .36), (0, .1, .232), 57, 7, (0, .12, .25), 960, 600)
    out['quad'] = quad(s, sw, sh); out['aspect'] = [1600, 900]

json.dump(out, open(W+f'/{which}.json', 'w'))
sc.render.filepath = W+f'/{which}.render.png'
bpy.ops.render.render(write_still=True)
