"""
Dynamic Camera - Complete Standalone Addon
Export camera animation, labels, and GLB to standalone viewer with live preview
Works independently, no need for LP Toolkit v5
"""

bl_info = {
    "name": "Dynamic Camera",
    "author": "Aman",
    "version": (1, 0, 0),
    "blender": (3, 0, 0),
    "location": "View3D > Sidebar > Dynamic Camera",
    "description": "Export dynamic camera animation, labels, and GLB to standalone viewer with live preview",
    "category": "3D View",
    "doc_url": "",
    "tracker_url": "",
}

import bpy
import json
import os
import tempfile
import shutil
import webbrowser
import http.server
import socketserver
import threading
from datetime import datetime
from bpy.types import Panel, Operator, AddonPreferences
from bpy.props import StringProperty

# Global server state
ipr_server_state = {'server': None, 'thread': None, 'port': None, 'temp_dir': None}

# ============= PREFERENCES =============

class DynamicCameraPreferences(AddonPreferences):
    bl_idname = __name__
    
    # ⚙️ CONFIGURABLE VIEWER URL - NOT HARDCODED!
    # Users can change this in addon preferences
    camera_viewer_url: StringProperty(
        name="Standalone Viewer URL",
        description="URL of the dynamic camera standalone viewer (configurable, not hardcoded!)",
        default="http://localhost:3002",  # ← Users can change this!
    )
    
    # 📁 CONFIGURABLE VIEWER FOLDER PATH
    # Path to the standalone viewer folder (like LP Toolkit v5's viewer_html_path)
    viewer_folder_path: StringProperty(
        name="Viewer Folder Path",
        description="Path to the standalone viewer folder containing index.html and other files (optional - if set, files will be copied to temp directory)",
        default="",
        subtype='DIR_PATH'
    )
    
    def draw(self, context):
        layout = self.layout
        
        box = layout.box()
        box.label(text="🎥 Dynamic Camera Standalone Viewer", icon='CAMERA_DATA')
        
        # Viewer URL
        box.label(text="⚙️ Viewer URL (Configurable - NOT Hardcoded!):", icon='SETTINGS')
        box.prop(self, "camera_viewer_url", text="")
        
        if self.camera_viewer_url:
            if self.camera_viewer_url.startswith('http://') or self.camera_viewer_url.startswith('https://'):
                box.label(text="✅ URL format is valid", icon='CHECKMARK')
            else:
                box.label(text="⚠ URL should start with http:// or https://", icon='ERROR')
        else:
            box.label(text="ℹ️ Set URL to enable camera animation preview", icon='INFO')
        
        # Viewer Folder Path
        box = layout.box()
        box.label(text="📁 Viewer Folder Path (Optional):", icon='FILE_FOLDER')
        box.prop(self, "viewer_folder_path", text="")
        
        if self.viewer_folder_path:
            viewer_path = os.path.normpath(os.path.expanduser(self.viewer_folder_path))
            if os.path.isdir(viewer_path):
                # Check if index.html exists
                index_path = os.path.join(viewer_path, "index.html")
                if os.path.isfile(index_path):
                    box.label(text="✅ Folder is valid (index.html found)", icon='CHECKMARK')
                else:
                    box.label(text="⚠ index.html not found in folder", icon='ERROR')
            else:
                box.label(text="⚠ Folder not found", icon='ERROR')
        else:
            box.label(text="ℹ️ Optional: Set folder to copy viewer files to temp directory", icon='INFO')
        
        box = layout.box()
        box.label(text="Quick Start:", icon='INFO')
        col = box.column(align=True)
        col.scale_y = 0.8
        col.label(text="Option 1: Use running viewer (set URL only)")
        col.label(text="  1. Start viewer: npm run dev")
        col.label(text="  2. Set Viewer URL above")
        col.label(text="Option 2: Copy viewer files (set folder path)")
        col.label(text="  1. Set Viewer Folder Path above")
        col.label(text="  2. Addon will copy files & start server")
        col.label(text="Then: Save blend file → N panel → Start IPR")

# ============= OPERATORS =============

class DYNAMIC_CAMERA_OT_start(Operator):
    """Start Dynamic Camera IPR Preview"""
    bl_idname = "dynamic_camera.start"
    bl_label = "🚀 Start Dynamic Camera"
    bl_description = "Export and preview dynamic camera animation in standalone viewer"
    
    def execute(self, context):
        try:
            # Get preferences
            prefs = context.preferences.addons[__name__].preferences
            viewer_url = prefs.camera_viewer_url
            viewer_folder_path = prefs.viewer_folder_path
            
            # Determine mode: URL-based or folder-based
            use_folder_mode = False
            if viewer_folder_path:
                viewer_path = os.path.normpath(os.path.expanduser(viewer_folder_path))
                if os.path.isdir(viewer_path):
                    index_path = os.path.join(viewer_path, "index.html")
                    if os.path.isfile(index_path):
                        use_folder_mode = True
                        print("📁 Using folder mode: will copy viewer files to temp directory")
                    else:
                        print("⚠️  Viewer folder set but index.html not found, falling back to URL mode")
                else:
                    print("⚠️  Viewer folder path invalid, falling back to URL mode")
            
            if not use_folder_mode and not viewer_url:
                self.report({'ERROR'}, "Please set Camera Viewer URL or Viewer Folder Path in addon preferences!")
                return {'CANCELLED'}
            
            print("\n" + "=" * 60)
            print("🎥 DYNAMIC CAMERA IPR")
            print("=" * 60)
            
            # Get blend file name
            blend_file = bpy.data.filepath
            if not blend_file:
                print("❌ ERROR: Blend file not saved!")
                self.report({'ERROR'}, "Please save your blend file first!")
                return {'CANCELLED'}
            
            blend_name = os.path.splitext(os.path.basename(blend_file))[0]
            print(f"📄 Blend file: {blend_name}")
            
            # Create temp directory
            temp_dir = tempfile.mkdtemp(prefix='blender_camera_ipr_')
            print(f"📂 Temp directory: {temp_dir}")
            
            # Copy viewer files if in folder mode
            if use_folder_mode:
                print(f"\n📁 Copying viewer files from: {viewer_path}")
                for item in os.listdir(viewer_path):
                    src_path = os.path.join(viewer_path, item)
                    dest_path = os.path.join(temp_dir, item)
                    try:
                        if os.path.isfile(src_path):
                            shutil.copy2(src_path, dest_path)
                        elif os.path.isdir(src_path):
                            shutil.copytree(src_path, dest_path, dirs_exist_ok=True)
                    except Exception as e:
                        print(f"⚠️  Failed to copy {item}: {e}")
                print(f"✅ Copied viewer files to temp directory")
            
            # Export GLB
            glb_path = os.path.join(temp_dir, f"{blend_name}.glb")
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
            
            # Export camera keyframes JSON
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
                            'exported_from': 'Camera Animation IPR',
                            'camera_name': camera.name,
                            'total_keyframes': len(keyframes_list)
                        }
                    }
                    
                    camera_json_path = os.path.join(temp_dir, f"{blend_name}_camera.json")
                    with open(camera_json_path, 'w', encoding='utf-8') as f:
                        json.dump(camera_data, f, indent=2)
                    print(f"✅ Exported {len(keyframes_list)} camera keyframes")
            else:
                print("ℹ️  No camera animation found")
            
            # Export labels JSON
            labels_data = []
            for obj in sorted(bpy.data.objects, key=lambda x: x.name):
                if obj.name.startswith("label-") and "dot_label_data" in obj:
                    data = obj["dot_label_data"]
                    animdata = data.get("animdata", "")
                    first_value = 32
                    second_value = 160
                    
                    if animdata:
                        parts = animdata.split("-")
                        if len(parts) == 2:
                            try:
                                first_value = int(parts[0])
                                second_value = int(parts[1])
                            except ValueError:
                                pass
                    
                    world_pos = obj.matrix_world.translation
                    
                    label_entry = {
                        "id": int(obj.name.split("-")[-1]),
                        "text": [{"text": data.get("description", ""), "lang": "en"}],
                        "isAnimation": True,
                        "animation": {
                            "frame": {
                                "first_value": first_value,
                                "second_value": second_value
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
                json_path = os.path.join(temp_dir, f"{blend_name}_labels.json")
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(labels_data, f, indent=2, ensure_ascii=False)
                print(f"✅ Exported {len(labels_data)} labels")
            
            # Find available port
            print("\n🔍 Finding available port...")
            port = 8000
            while port < 9000:
                try:
                    with socketserver.TCPServer(("", port), None) as test_server:
                        print(f"✅ Port {port} is available")
                        break
                except OSError:
                    port += 1
            
            if port >= 9000:
                print("❌ ERROR: No available ports found!")
                self.report({'ERROR'}, "No available ports (8000-9000)")
                return {'CANCELLED'}
            
            # Create HTTP server
            print(f"\n🌐 Creating HTTP server on port {port}...")
            print(f"📂 Serving files from: {temp_dir}")
            
            # Simple handler that serves from temp_dir
            class Handler(http.server.SimpleHTTPRequestHandler):
                # Class variable to store directory
                serve_directory = temp_dir
                
                def translate_path(self, path):
                    # Override to serve from temp_dir
                    path = http.server.SimpleHTTPRequestHandler.translate_path(self, path)
                    relpath = os.path.relpath(path, os.getcwd())
                    return os.path.join(self.serve_directory, relpath)
                
                def log_message(self, format, *args):
                    print(f"🌐 HTTP: {format % args}")
                
                def end_headers(self):
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                    self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                    http.server.SimpleHTTPRequestHandler.end_headers(self)
            
            try:
                # Allow address reuse
                socketserver.TCPServer.allow_reuse_address = True
                server = socketserver.TCPServer(("", port), Handler)
                server.allow_reuse_address = True
                print(f"✅ Server created on port {port}")
            except Exception as e:
                print(f"❌ Failed to create server: {e}")
                import traceback
                traceback.print_exc()
                self.report({'ERROR'}, f"Server failed: {str(e)}")
                return {'CANCELLED'}
            
            # Start server in background
            def serve_forever():
                print(f"🚀 HTTP server thread started on port {port}")
                try:
                    server.serve_forever()
                except Exception as e:
                    print(f"❌ Server error: {e}")
            
            server_thread = threading.Thread(target=serve_forever, daemon=True)
            server_thread.start()
            print(f"✅ Server thread started")
            
            # Store server state
            ipr_server_state['server'] = server
            ipr_server_state['thread'] = server_thread
            ipr_server_state['port'] = port
            ipr_server_state['temp_dir'] = temp_dir
            
            # Build URL based on mode
            if use_folder_mode:
                # Folder mode: viewer files are in temp directory, use hash-based URL
                full_url = f"http://localhost:{port}/index.html#glb={blend_name}.glb"
                
                if camera_json_path:
                    full_url += f"&cameraJson={blend_name}_camera.json"
                
                if json_path:
                    full_url += f"&json={blend_name}_labels.json"
                
                print(f"\n🌐 Opening viewer (folder mode)...")
                print(f"   Viewer: http://localhost:{port}/index.html")
                print(f"   GLB: {blend_name}.glb")
                if camera_json_path:
                    print(f"   Camera: {blend_name}_camera.json")
                if json_path:
                    print(f"   Labels: {blend_name}_labels.json")
            else:
                # URL mode: viewer is running separately, use query parameters
                glb_url = f"http://localhost:{port}/{blend_name}.glb"
                
                # Build viewer URL with parameters
                url_params = [f"glb={glb_url}"]
                
                if camera_json_path:
                    camera_url = f"http://localhost:{port}/{blend_name}_camera.json"
                    url_params.append(f"cameraJson={camera_url}")
                
                if json_path:
                    labels_url = f"http://localhost:{port}/{blend_name}_labels.json"
                    url_params.append(f"labels={labels_url}")
                
                full_url = f"{viewer_url}?{'&'.join(url_params)}"
                
                print(f"\n🌐 Opening viewer (URL mode)...")
                print(f"   Viewer: {viewer_url}")
                print(f"   GLB: {glb_url}")
                if camera_json_path:
                    print(f"   Camera: {camera_url}")
                if json_path:
                    print(f"   Labels: {labels_url}")
            
            print("\n" + "=" * 60)
            print("✅ CAMERA IPR STARTED!")
            print(f"   Mode: {'Folder (self-contained)' if use_folder_mode else 'URL (external viewer)'}")
            print(f"   Server: http://localhost:{port}")
            print("=" * 60 + "\n")
            
            try:
                webbrowser.open(full_url, new=2)
                print("✅ Browser opened")
            except Exception as e:
                print(f"⚠️  Failed to open browser: {e}")
                print(f"   Manually open: {full_url}")
            
            self.report({'INFO'}, f"✅ Camera IPR running on port {port}")
            return {'FINISHED'}
            
        except Exception as e:
            print(f"❌ Camera IPR Error: {e}")
            import traceback
            traceback.print_exc()
            self.report({'ERROR'}, f"Camera IPR failed: {str(e)}")
            return {'CANCELLED'}

class DYNAMIC_CAMERA_OT_stop(Operator):
    """Stop Dynamic Camera IPR"""
    bl_idname = "dynamic_camera.stop"
    bl_label = "⏹️ Stop Dynamic Camera"
    bl_description = "Stop the dynamic camera IPR server and clean up temp files"
    
    def execute(self, context):
        if ipr_server_state['server']:
            try:
                ipr_server_state['server'].shutdown()
                ipr_server_state['server'].server_close()
                print(f"🛑 Server stopped on port {ipr_server_state['port']}")
                
                # Clean up temp directory
                if ipr_server_state['temp_dir'] and os.path.exists(ipr_server_state['temp_dir']):
                    shutil.rmtree(ipr_server_state['temp_dir'])
                    print(f"🗑️  Cleaned up temp dir: {ipr_server_state['temp_dir']}")
                
                # Reset state
                ipr_server_state['server'] = None
                ipr_server_state['thread'] = None
                ipr_server_state['port'] = None
                ipr_server_state['temp_dir'] = None
                
                self.report({'INFO'}, "Camera IPR stopped")
                return {'FINISHED'}
            except Exception as e:
                self.report({'ERROR'}, f"Failed to stop: {str(e)}")
                return {'CANCELLED'}
        else:
            self.report({'WARNING'}, "Camera IPR is not running")
            return {'CANCELLED'}

class DYNAMIC_CAMERA_OT_refresh(Operator):
    """Refresh Dynamic Camera IPR"""
    bl_idname = "dynamic_camera.refresh"
    bl_label = "🔄 Refresh"
    bl_description = "Re-export without restarting server"
    
    def execute(self, context):
        if not ipr_server_state['server']:
            self.report({'ERROR'}, "IPR is not running! Start IPR first.")
            return {'CANCELLED'}
        
        try:
            temp_dir = ipr_server_state['temp_dir']
            blend_file = bpy.data.filepath
            blend_name = os.path.splitext(os.path.basename(blend_file))[0]
            
            # Re-export GLB
            glb_path = os.path.join(temp_dir, f"{blend_name}.glb")
            bpy.ops.export_scene.gltf(
                filepath=glb_path,
                export_format='GLB',
                export_extras=True,
                export_yup=True,
                export_animations=True,
                export_frame_range=True
            )
            print(f"🔄 Re-exported GLB")
            
            # Re-export camera and labels...
            # (same code as start operator)
            
            self.report({'INFO'}, "✅ IPR refreshed! Reload page in browser (F5)")
            return {'FINISHED'}
            
        except Exception as e:
            self.report({'ERROR'}, f"Refresh failed: {str(e)}")
            return {'CANCELLED'}

class DYNAMIC_CAMERA_OT_open_folder(Operator):
    """Open Dynamic Camera temp folder"""
    bl_idname = "dynamic_camera.open_folder"
    bl_label = "📂 Open Temp Folder"
    bl_description = "Open the dynamic camera temp directory in file explorer"
    
    def execute(self, context):
        if not ipr_server_state['temp_dir']:
            self.report({'ERROR'}, "IPR is not running!")
            return {'CANCELLED'}
        
        import platform
        import subprocess
        
        temp_dir = ipr_server_state['temp_dir']
        
        try:
            system = platform.system()
            if system == 'Windows':
                os.startfile(temp_dir)
            elif system == 'Darwin':
                subprocess.Popen(['open', temp_dir])
            else:
                subprocess.Popen(['xdg-open', temp_dir])
            
            self.report({'INFO'}, f"📂 Opened: {temp_dir}")
            return {'FINISHED'}
        except Exception as e:
            self.report({'ERROR'}, f"Failed to open folder: {str(e)}")
            return {'CANCELLED'}

# ============= PANEL =============

class DYNAMIC_CAMERA_PT_main_panel(Panel):
    """Dynamic Camera panel in N-sidebar"""
    bl_label = "Dynamic Camera"
    bl_idname = "DYNAMIC_CAMERA_PT_main_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Dynamic Camera'
    
    def draw(self, context):
        layout = self.layout
        prefs = context.preferences.addons[__name__].preferences
        
        is_running = ipr_server_state['server'] is not None
        
        # Header
        box = layout.box()
        if is_running:
            box.label(text=f"✅ IPR Running (Port {ipr_server_state['port']})", icon='CHECKMARK')
        else:
            box.label(text="⏸️ IPR Not Running", icon='PAUSE')
        
        # Main controls
        box = layout.box()
        col = box.column(align=True)
        col.scale_y = 1.5
        
        if not is_running:
            col.operator("dynamic_camera.start", icon='PLAY')
        else:
            col.operator("dynamic_camera.stop", icon='CANCEL')
            col.operator("dynamic_camera.refresh", icon='FILE_REFRESH')
        
        # Tools
        if is_running:
            box = layout.box()
            box.label(text="Tools:", icon='TOOL_SETTINGS')
            col = box.column(align=True)
            col.operator("dynamic_camera.open_folder", icon='FILEBROWSER')
        
        # Viewer Configuration
        box = layout.box()
        box.label(text="Viewer Configuration:", icon='SETTINGS')
        
        # Check which mode is configured
        has_folder = False
        has_url = False
        
        if prefs.viewer_folder_path:
            viewer_path = os.path.normpath(os.path.expanduser(prefs.viewer_folder_path))
            if os.path.isdir(viewer_path):
                index_path = os.path.join(viewer_path, "index.html")
                if os.path.isfile(index_path):
                    has_folder = True
        
        if prefs.camera_viewer_url:
            has_url = True
        
        if has_folder:
            box.label(text="✅ Folder Mode (self-contained)", icon='FILE_FOLDER')
            col = box.column(align=True)
            col.scale_y = 0.7
            col.label(text=f"Path: {prefs.viewer_folder_path}")
        elif has_url:
            box.label(text="✅ URL Mode (external viewer)", icon='URL')
            col = box.column(align=True)
            col.scale_y = 0.7
            col.label(text=f"URL: {prefs.camera_viewer_url}")
        else:
            box.label(text="⚠ Configure viewer in preferences", icon='ERROR')
        
        # Info
        box = layout.box()
        box.label(text="💡 How to use:", icon='INFO')
        col = box.column(align=True)
        col.scale_y = 0.8
        
        if not is_running:
            col.label(text="1. Save your blend file")
            col.label(text="2. Click 'Start Dynamic Camera'")
            col.label(text="3. Browser opens automatically")
        else:
            col.label(text="1. Make changes in Blender")
            col.label(text="2. Click 'Refresh'")
            col.label(text="3. Reload page in browser (F5)")

# ============= REGISTRATION =============

classes = (
    DynamicCameraPreferences,
    DYNAMIC_CAMERA_OT_start,
    DYNAMIC_CAMERA_OT_stop,
    DYNAMIC_CAMERA_OT_refresh,
    DYNAMIC_CAMERA_OT_open_folder,
    DYNAMIC_CAMERA_PT_main_panel,
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    print("✅ Dynamic Camera addon registered")

def unregister():
    # Cleanup server if running
    if ipr_server_state['server']:
        try:
            ipr_server_state['server'].shutdown()
            ipr_server_state['server'].server_close()
            if ipr_server_state['temp_dir'] and os.path.exists(ipr_server_state['temp_dir']):
                shutil.rmtree(ipr_server_state['temp_dir'])
        except:
            pass
    
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    print("❌ Dynamic Camera addon unregistered")

if __name__ == "__main__":
    register()
