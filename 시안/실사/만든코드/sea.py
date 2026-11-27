import bpy,math,os
W=os.path.dirname(os.path.abspath(__file__));bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene
sc.render.engine='CYCLES';sc.cycles.samples=96;sc.cycles.use_denoising=True;sc.view_settings.view_transform='AgX';sc.view_settings.look='AgX - Medium High Contrast';sc.view_settings.exposure=-4.5
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;t=w.node_tree;s=t.nodes.new('ShaderNodeTexSky');s.sky_type='NISHITA';s.sun_elevation=math.radians(4);s.sun_rotation=math.radians(9);s.sun_size=math.radians(1.2);s.sun_intensity=.25;s.dust_density=2.5;s.air_density=1.3
# 엷은 구름: 하늘 빛에 높이별 얼룩을 섞음
c=t.nodes.new('ShaderNodeTexCoord');mp=t.nodes.new('ShaderNodeMapping');mp.inputs['Scale'].default_value=(1.6,1.6,11);n=t.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=2.4;n.inputs['Detail'].default_value=9;n.inputs['Distortion'].default_value=.5
r=t.nodes.new('ShaderNodeValToRGB');r.color_ramp.elements[0].position=.45;r.color_ramp.elements[0].color=(1,1,1,1);r.color_ramp.elements[1].position=.75;r.color_ramp.elements[1].color=(2.1,1.5,1.25,1)
m=t.nodes.new('ShaderNodeMix');m.data_type='RGBA';m.blend_type='MULTIPLY';m.inputs[0].default_value=.8;L=t.links.new
L(c.outputs['Generated'],mp.inputs[0]);L(mp.outputs[0],n.inputs[0]);L(n.outputs['Fac'],r.inputs[0]);L(s.outputs[0],m.inputs[6]);L(r.outputs[0],m.inputs[7]);L(m.outputs[2],t.nodes['Background'].inputs[0])
bpy.ops.mesh.primitive_plane_add(size=20000);o=bpy.context.object;a=bpy.data.materials.new('sea');a.use_nodes=True;o.data.materials.append(a);t=a.node_tree;p=t.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.012,.04,.06,1);p.inputs['Roughness'].default_value=.1;p.inputs['IOR'].default_value=1.33
c=t.nodes.new('ShaderNodeTexCoord');h=None
for sca,dist in((.35,.5),(1.6,.12)):
    n=t.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=sca;n.inputs['Detail'].default_value=6;b=t.nodes.new('ShaderNodeBump');b.inputs['Distance'].default_value=dist;b.inputs['Strength'].default_value=.7
    t.links.new(c.outputs['Object'],n.inputs['Vector']);t.links.new(n.outputs['Fac'],b.inputs['Height'])
    if h:t.links.new(h.outputs[0],b.inputs['Normal'])
    h=b
t.links.new(h.outputs[0],p.inputs['Normal'])
cd=bpy.data.cameras.new('c');k=bpy.data.objects.new('c',cd);sc.collection.objects.link(k);k.location=(0,0,4);k.rotation_euler=(math.radians(93),0,0);cd.lens=32;cd.clip_end=30000;sc.camera=k;sc.render.resolution_x=1280;sc.render.resolution_y=720;sc.render.filepath=W+'/sea.png';bpy.ops.render.render(write_still=True)
