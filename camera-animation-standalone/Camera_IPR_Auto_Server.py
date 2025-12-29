"""
Camera IPR Auto Server - Automatic viewer startup addon
Automatically starts the Next.js viewer and exports files to public folder
Completely independent from LP Toolkit v5 - no name conflicts
"""

bl_info = {
    "name": "Camera IPR Auto Server",
    "author": "Aman",
    "version": (1, 1, 0),
    "blender": (3, 0, 0),
    "location": "View3D > Sidebar > IPR Auto",
    "description": "Auto-start viewer and export camera animation with labels",
    "category": "Import-Export",
    "doc_url": "",
    "tracker_url": "",
}

import bpy
import json
import os
import subprocess
import webbrowser
import time
from bpy.types import Panel, Operator, AddonPreferences
from bpy.props import StringProperty, BoolProperty

# Global state
auto_server_state = {
    'server_running': False,
    'viewer_url': 'http://localhost:3002',
    'process': None
}

# ============= PREFERENCES =============

class CameraIPRAutoPreferences(AddonPreferences):
    bl_idname = __name__
    
    viewer_folder_path: StringProperty(
        name="Viewer Folder Path",
        description="Path to the camera-animation-standalone folder",
        default="",
        subtype='DIR_PATH'
    )
    
    def draw(self, context):
        layout = self.layout
        
        box = layout.box()
        box.label(text="🎥 Camera IPR Auto Server", icon='CAMERA_DATA')
        
        box.label(text="📁 Viewer Folder Path:", icon='FILE_FOLDER')
        box.prop(self, "viewer_folder_path", text="")
        
        if self.viewer_folder_path:
            viewer_path = os.path.normpath(os.path.expanduser(self.viewer_folder_path))
            if os.path.isdir(viewer_path):
                # Check for run.bat or package.json
                run_bat = os.path.join(viewer_path, "run.bat")
                package_json = os.path.join(viewer_path, "package.json")
                public_folder = os.path.join(viewer_path, "public")
                
                if os.path.isfile(run_bat):
                    box.label(text="✅ run.bat found (fast startup)", icon='CHECKMARK')
                elif os.path.isfile(package_json):
                    box.label(text="✅ package.json found (npm mode)", icon='CHECKMARK')
                else:
                    box.label(text="⚠ No run.bat or package.json found", icon='ERROR')
                
                if os.path.isdir(public_folder):
                    box.label(text="✅ public folder found", icon='CHECKMARK')
                else:
                    box.label(text="⚠ public folder not found", icon='ERROR')
            else:
                box.label(text="⚠ Folder not found", icon='ERROR')
        else:
            box.label(text="ℹ️ Set path to camera-animation-standalone folder", icon='INFO')
        
        box = layout.box()
        box.label(text="Quick Start:", icon='INFO')
        col = box.column(align=True)
        col.scale_y = 0.8
        col.label(text="1. Set Viewer Folder Path above")
        col.label(text="2. Save your blend file")
        col.label(text="3. Click 'Start IPR' in N panel")
        col.label(text="4. Viewer starts automatically!")

# ============= OPERATORS =============

class CAMERA_IPR_AUTO_OT_start(Operator):
    """Start Camera IPR with auto server"""
    bl_idname = "camera_ipr_auto.start"
    bl_label = "🚀 Start IPR"
    bl_description = "Export files and start viewer automatically"
    
    def execute(self, context):
        try:
            prefs = context.preferences.addons[__name__].preferences
            viewer_folder = prefs.viewer_folder_path
            
            if not viewer_folder:
                self.report({'ERROR'}, "Set Viewer Folder Path in addon preferences!")
                return {'CANCELLED'}
            
            viewer_path = os.path.normpath(os.path.expanduser(viewer_folder))
            if not os.path.isdir(viewer_path):
                self.report({'ERROR'}, "Viewer folder not found!")
                return {'CANCELLED'}
            
            print("\n" + "=" * 60)
            print("🎥 CAMERA IPR AUTO SERVER")
            print("=" * 60)
            
            # Check if blend file is saved
            blend_file = bpy.data.filepath
            if not blend_file:
                self.report({'ERROR'}, "Save your blend file first!")
                return {'CANCELLED'}
            
            blend_name = os.path.splitext(os.path.basename(blend_file))[0]
            print(f"📄 Blend file: {blend_name}")
            
            # Export to public folder
            public_folder = os.path.join(viewer_path, "public")
            if not os.path.isdir(public_folder):
                os.makedirs(public_folder)
                print(f"📂 Created public folder: {public_folder}")
            
            # Export GLB
            glb_path = os.path.join(public_folder, f"{blend_name}.glb")
            bpy.ops.export_scene.gltf(
                filepath=glb_path,
                export_format='GLB',
                export_extras=True,
                export_yup=True,
                export_animations=True,
                export_frame_range=True
            )
            file_size = os.path.getsize(glb_path) / (1024 * 1024)
            print(f"✅ Exported GLB: {blend_name}.glb ({file_size:.2f} MB)")
            
            # Export camera keyframes
            camera = context.scene.camera
            camera_json_path = None
            
            if camera and camera.animation_data and camera.animation_data.action:
                print(f"🎥 Exporting camera animation from: {camera.name}")
                
                action = camera.animation_data.action
                keyframes_dict = {}
                
                for fcurve in action.fcurves:
                    data_path = fcurve.data_path
                    array_index = fcurve.array_index
                    
                    for keyframe in fcurve.keyframe_points:
                        frame = int(keyframe.co.x)
                        value = keyframe.co.y
                        
                        if frame not in keyframes_dict:
                            keyframes_dict[frame] = {
                                'frame': frame,
                                'time': round(frame / 24, 2),
                                'properties': {
                                    'theta': [0],
                                    'phi': [75],
                                    'radius': [105],
                                    'targetX': [0],
                                    'targetY': [0],
                                    'targetZ': [0],
                                    'fov': [45]
                                },
                                'name': f'Frame {frame}'
                            }
                        
                        if 'location' in data_path:
                            if array_index == 0:
                                keyframes_dict[frame]['properties']['targetX'] = [value]
                            elif array_index == 1:
                                keyframes_dict[frame]['properties']['targetY'] = [value]
                            elif array_index == 2:
                                keyframes_dict[frame]['properties']['targetZ'] = [value]
                        elif 'rotation_euler' in data_path:
                            if array_index == 0:
                                keyframes_dict[frame]['properties']['phi'] = [value * 57.2958]
                            elif array_index == 2:
                                keyframes_dict[frame]['properties']['theta'] = [value * 57.2958]
                
                keyframes_list = sorted(keyframes_dict.values(), key=lambda x: x['frame'])
                
                if keyframes_list:
                    camera_data = {
                        'keyframes': keyframes_list,
                        'metadata': {
                            'exported_from': 'Camera IPR Auto Server',
                            'camera_name': camera.name,
                            'total_keyframes': len(keyframes_list)
                        }
                    }
                    
                    camera_json_path = os.path.join(public_folder, f"{blend_name}_camera.json")
                    with open(camera_json_path, 'w', encoding='utf-8') as f:
                        json.dump(camera_data, f, indent=2)
                    print(f"✅ Exported {len(keyframes_list)} camera keyframes")
            else:
                print("ℹ️  No camera animation found")
            
            # Export labels with full animation data
            labels_data = []
            for obj in sorted(bpy.data.objects, key=lambda x: x.name):
                if obj.name.startswith("label-") and "dot_label_data" in obj:
                    data = obj["dot_label_data"]
                    animdata = data.get("animdata", "")
                    
                    # Parse animation data: "32-160" format
                    appear_frame = 32
                    disappear_frame = 160
                    
                    if animdata:
                        parts = animdata.split("-")
                        if len(parts) == 2:
                            try:
                                appear_frame = int(parts[0])
                                disappear_frame = int(parts[1])
                            except ValueError:
                                pass
                    
                    world_pos = obj.matrix_world.translation
                    
                    # Full label data with animation frames
                    label_entry = {
                        "id": int(obj.name.split("-")[-1]),
                        "text": [{"text": data.get("description", ""), "lang": "en"}],
                        "isAnimation": True,
                        "appearFrame": appear_frame,
                        "disappearFrame": disappear_frame,
                        "animation": {
                            "frame": {
                                "first_value": appear_frame,
                                "second_value": disappear_frame
                            }
                        },
                        "position": {
                            "x": round(world_pos.x, 4),
                            "y": round(world_pos.z, 4),
                            "z": round(-world_pos.y, 4)
                        }
                    }
                    labels_data.append(label_entry)
            
            json_path = None
            if labels_data:
                json_path = os.path.join(public_folder, f"{blend_name}_labels.json")
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(labels_data, f, indent=2, ensure_ascii=False)
                print(f"✅ Exported {len(labels_data)} labels with animation data")
            
            # Start server if not running
            if not auto_server_state['server_running']:
                print("\n🚀 Starting viewer server...")
                
                # Check for run.bat (faster) or use npm
                run_bat = os.path.join(viewer_path, "run.bat")
                
                if os.path.isfile(run_bat):
                    print("📦 Using run.bat (fast startup - 2 seconds)")
                    # Use cd /d to change directory properly on Windows
                    cmd = f'cd /d "{viewer_path}" && run.bat'
                    wait_time = 2
                else:
                    print("📦 Using npm run dev (5 seconds)")
                    cmd = f'cd /d "{viewer_path}" && npm run dev'
                    wait_time = 5
                
                # Start process in background
                try:
                    # Use shell=True and CREATE_NEW_CONSOLE to run in background
                    process = subprocess.Popen(
                        cmd,
                        shell=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
                    )
                    auto_server_state['process'] = process
                    auto_server_state['server_running'] = True
                    
                    print(f"⏳ Waiting {wait_time} seconds for server to start...")
                    time.sleep(wait_time)
                    
                    # Open browser
                    viewer_url = f"{auto_server_state['viewer_url']}?glb={blend_name}.glb"
                    if camera_json_path:
                        viewer_url += f"&cameraJson={blend_name}_camera.json"
                    if json_path:
                        viewer_url += f"&labels={blend_name}_labels.json"
                    
                    print(f"🌐 Opening browser: {viewer_url}")
                    webbrowser.open(viewer_url, new=2)
                    
                    print("\n" + "=" * 60)
                    print("✅ IPR STARTED! Server running")
                    print(f"   Viewer: {auto_server_state['viewer_url']}")
                    print(f"   Files: {public_folder}")
                    print("=" * 60 + "\n")
                    
                    self.report({'INFO'}, "✅ IPR started! Server running")
                    
                except Exception as e:
                    print(f"❌ Failed to start server: {e}")
                    import traceback
                    traceback.print_exc()
                    self.report({'ERROR'}, f"Server failed: {str(e)}")
                    return {'CANCELLED'}
            else:
                # Server already running, just re-export
                print("\n" + "=" * 60)
                print("✅ FILES RE-EXPORTED!")
                print(f"   Files: {public_folder}")
                print("   Reload browser (F5) to see changes")
                print("=" * 60 + "\n")
                
                self.report({'INFO'}, "✅ Files re-exported! Reload browser (F5)")
            
            return {'FINISHED'}
            
        except Exception as e:
            print(f"❌ IPR Error: {e}")
            import traceback
            traceback.print_exc()
            self.report({'ERROR'}, f"IPR failed: {str(e)}")
            return {'CANCELLED'}

class CAMERA_IPR_AUTO_OT_open_viewer(Operator):
    """Open viewer in browser"""
    bl_idname = "camera_ipr_auto.open_viewer"
    bl_label = "🌐 Open Viewer"
    bl_description = "Open viewer in browser without re-exporting"
    
    def execute(self, context):
        if not auto_server_state['server_running']:
            self.report({'WARNING'}, "Server not running! Click 'Start IPR' first")
            return {'CANCELLED'}
        
        try:
            blend_file = bpy.data.filepath
            if not blend_file:
                self.report({'ERROR'}, "Save your blend file first!")
                return {'CANCELLED'}
            
            blend_name = os.path.splitext(os.path.basename(blend_file))[0]
            viewer_url = f"{auto_server_state['viewer_url']}?glb={blend_name}.glb&cameraJson={blend_name}_camera.json&labels={blend_name}_labels.json"
            
            webbrowser.open(viewer_url, new=2)
            self.report({'INFO'}, "✅ Opened viewer in browser")
            return {'FINISHED'}
            
        except Exception as e:
            self.report({'ERROR'}, f"Failed: {str(e)}")
            return {'CANCELLED'}

class CAMERA_IPR_AUTO_OT_stop(Operator):
    """Stop viewer server"""
    bl_idname = "camera_ipr_auto.stop"
    bl_label = "⏹️ Stop Server"
    bl_description = "Stop the viewer server"
    
    def execute(self, context):
        if not auto_server_state['server_running']:
            self.report({'WARNING'}, "Server not running")
            return {'CANCELLED'}
        
        try:
            # Kill the process
            if auto_server_state['process']:
                auto_server_state['process'].terminate()
                print("🛑 Server process terminated")
            
            # Reset state
            auto_server_state['server_running'] = False
            auto_server_state['process'] = None
            
            self.report({'INFO'}, "✅ Server stopped")
            return {'FINISHED'}
            
        except Exception as e:
            self.report({'ERROR'}, f"Failed to stop: {str(e)}")
            return {'CANCELLED'}

# ============= PANEL =============

class CAMERA_IPR_AUTO_PT_main_panel(Panel):
    """Camera IPR Auto panel in N-sidebar"""
    bl_label = "Camera IPR Auto"
    bl_idname = "CAMERA_IPR_AUTO_PT_main_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'IPR Auto'
    
    def draw(self, context):
        layout = self.layout
        prefs = context.preferences.addons[__name__].preferences
        
        is_running = auto_server_state['server_running']
        
        # Header
        box = layout.box()
        if is_running:
            box.label(text="✅ Server Running", icon='CHECKMARK')
        else:
            box.label(text="⏸️ Server Not Running", icon='PAUSE')
        
        # Main controls - SEPARATE BUTTONS (not merged)
        box = layout.box()
        col = box.column(align=True)
        col.scale_y = 1.5
        
        # Start IPR button with dynamic feedback
        if not is_running:
            col.operator("camera_ipr_auto.start", text="🚀 Start IPR", icon='PLAY')
        else:
            col.operator("camera_ipr_auto.start", text="🔄 Re-export Files", icon='FILE_REFRESH')
        
        # Separate Open Viewer button
        if is_running:
            col.operator("camera_ipr_auto.open_viewer", icon='URL')
        
        # Separate Stop button
        if is_running:
            col.operator("camera_ipr_auto.stop", icon='CANCEL')
        
        # Configuration status
        box = layout.box()
        box.label(text="Configuration:", icon='SETTINGS')
        
        if prefs.viewer_folder_path:
            viewer_path = os.path.normpath(os.path.expanduser(prefs.viewer_folder_path))
            if os.path.isdir(viewer_path):
                box.label(text="✅ Viewer folder configured", icon='CHECKMARK')
                col = box.column(align=True)
                col.scale_y = 0.7
                col.label(text=f"Path: {prefs.viewer_folder_path}")
            else:
                box.label(text="⚠ Folder not found", icon='ERROR')
        else:
            box.label(text="⚠ Configure in preferences", icon='ERROR')
        
        # Info
        box = layout.box()
        box.label(text="💡 How to use:", icon='INFO')
        col = box.column(align=True)
        col.scale_y = 0.8
        
        if not is_running:
            col.label(text="1. Save your blend file")
            col.label(text="2. Click 'Start IPR'")
            col.label(text="3. Viewer opens automatically")
        else:
            col.label(text="1. Make changes in Blender")
            col.label(text="2. Click 'Re-export Files'")
            col.label(text="3. Reload browser (F5)")

# ============= REGISTRATION =============

classes = (
    CameraIPRAutoPreferences,
    CAMERA_IPR_AUTO_OT_start,
    CAMERA_IPR_AUTO_OT_open_viewer,
    CAMERA_IPR_AUTO_OT_stop,
    CAMERA_IPR_AUTO_PT_main_panel,
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    print("✅ Camera IPR Auto Server addon registered")

def unregister():
    # Cleanup
    if auto_server_state['process']:
        try:
            auto_server_state['process'].terminate()
        except:
            pass
    
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    print("❌ Camera IPR Auto Server addon unregistered")

if __name__ == "__main__":
    register()
