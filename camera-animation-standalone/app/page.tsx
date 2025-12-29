'use client';
import { useState, useEffect } from 'react';
import ModelViewerContainer from './components/ModelViewerContainer';

export default function Home() {
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [cameraJsonUrl, setCameraJsonUrl] = useState<string | null>(null);
  const [labelJsonData, setLabelJsonData] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Check URL parameters for auto-loading (IPR mode)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Check for GLB URL
    const glbUrl = params.get('glb');
    if (glbUrl) {
      setModelUrl(glbUrl);
      console.log('📦 GLB URL detected from URL parameter:', glbUrl);
    }
    
    // Check for camera JSON URL
    const jsonUrl = params.get('cameraJson');
    if (jsonUrl) {
      setCameraJsonUrl(jsonUrl);
      console.log('🎥 Camera JSON URL detected from URL parameter:', jsonUrl);
    }
    
    // Check for labels JSON URL
    const labelsUrl = params.get('labels');
    if (labelsUrl) {
      // Fetch and load labels
      fetch(labelsUrl)
        .then(res => res.json())
        .then(data => {
          setLabelJsonData(data);
          console.log('🏷️ Labels JSON loaded from URL parameter:', labelsUrl);
        })
        .catch(err => console.error('❌ Failed to load labels from URL:', err));
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setModelFile(file);
      const url = URL.createObjectURL(file);
      setModelUrl(url);
    }
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.json')) {
      const url = URL.createObjectURL(file);
      setCameraJsonUrl(url);
      console.log('🎥 Camera JSON loaded via upload:', file.name);
    }
  };

  const handleLabelJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setLabelJsonData(data);
          console.log('🏷️ Label JSON loaded via upload:', file.name);
        } catch (error) {
          console.error('❌ Failed to parse label JSON:', error);
          alert('Failed to load label JSON. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  // Handle drag and drop for JSON files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Check if it's a JSON file
    if (file.name.endsWith('.json')) {
      // Try to determine if it's camera JSON or label JSON by reading it
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          
          // Check if it's camera JSON (has keyframes)
          if (data.keyframes && Array.isArray(data.keyframes)) {
            const url = URL.createObjectURL(file);
            setCameraJsonUrl(url);
            console.log('🎥 Camera JSON loaded via drag & drop:', file.name);
          }
          // Check if it's label JSON (array of label objects with id, text, etc.)
          else if (Array.isArray(data) && data.length > 0 && data[0].id !== undefined) {
            setLabelJsonData(data);
            console.log('🏷️ Label JSON loaded via drag & drop:', file.name);
          }
          // Default to camera JSON
          else {
            const url = URL.createObjectURL(file);
            setCameraJsonUrl(url);
            console.log('🎥 JSON loaded via drag & drop:', file.name);
          }
        } catch (error) {
          console.error('❌ Failed to parse JSON:', error);
        }
      };
      reader.readAsText(file);
    } 
    // Check if it's a model file
    else if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
      setModelFile(file);
      const url = URL.createObjectURL(file);
      setModelUrl(url);
      console.log('📦 Model loaded via drag & drop:', file.name);
    }
  };

  if (!modelUrl) {
    return (
      <div 
        className={`w-screen h-screen flex items-center justify-center flex-col gap-6 bg-gradient-to-br from-gray-900 to-black ${
          isDragging ? 'ring-4 ring-blue-500 ring-inset' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <h1 className="text-4xl font-bold mb-4">Camera Animation Tool</h1>
        <p className="text-gray-400 mb-8">Load a 3D model to start creating camera animations</p>
        
        <div className="flex flex-col gap-3">
          <label className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors flex items-center gap-2 justify-center">
            <span>📁</span>
            <span>Load GLB/GLTF Model</span>
            <input
              type="file"
              accept=".glb,.gltf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          
          <label className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg cursor-pointer transition-colors flex items-center gap-2 justify-center">
            <span>🎬</span>
            <span>Load Camera JSON (Optional)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleJsonUpload}
              className="hidden"
            />
          </label>
          
          <label className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg cursor-pointer transition-colors flex items-center gap-2 justify-center">
            <span>🏷️</span>
            <span>Load Label JSON (Optional)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleLabelJsonUpload}
              className="hidden"
            />
          </label>
        </div>
        
        <p className="text-gray-500 text-sm mt-4">
          💡 Tip: Drag & drop GLB/GLTF, camera JSON, or label JSON files anywhere
        </p>
        <div className="flex flex-col gap-2 mt-4">
          {cameraJsonUrl && (
            <div className="px-4 py-2 bg-purple-600/20 border border-purple-500 rounded-lg">
              <p className="text-purple-400 text-sm">✅ Camera JSON ready to load</p>
            </div>
          )}
          {labelJsonData && (
            <div className="px-4 py-2 bg-green-600/20 border border-green-500 rounded-lg">
              <p className="text-green-400 text-sm">✅ Label JSON ready to load ({Array.isArray(labelJsonData) ? labelJsonData.length : 0} labels)</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-screen h-screen"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ModelViewerContainer 
        modelUrl={modelUrl} 
        onChangeModel={handleFileUpload}
        cameraJsonUrl={cameraJsonUrl || undefined}
        labelData={labelJsonData}
      />
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/20 border-4 border-blue-500 border-dashed pointer-events-none z-50 flex items-center justify-center">
          <p className="text-white text-2xl font-bold">Drop JSON file to load camera animation</p>
        </div>
      )}
    </div>
  );
}
