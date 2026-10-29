'use client';
import { useState, useEffect, useRef } from 'react';
import ModelViewerContainer from './components/ModelViewerContainer';

const getCompanionAssetUrl = (modelUrl: string, suffix: string) => {
  if (modelUrl.startsWith('blob:') || modelUrl.startsWith('data:')) return null;

  try {
    const url = new URL(modelUrl, window.location.href);
    const lastSlash = url.pathname.lastIndexOf('/');
    const directory = url.pathname.slice(0, lastSlash + 1);
    const fileName = url.pathname.slice(lastSlash + 1);
    const baseName = fileName.replace(/\.(glb|gltf)$/i, '');

    url.pathname = `${directory}${baseName}${suffix}`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};

const normalizeModelUrl = (modelNameOrUrl: string) =>
  /\.(glb|gltf)(?:[?#].*)?$/i.test(modelNameOrUrl)
    ? modelNameOrUrl
    : `${modelNameOrUrl}.glb`;

type CrpModel = {
  model_id: string;
  file_name?: string;
  model_name?: string;
  signed_url?: string;
  download_url?: string;
};

const getCrpModels = (payload: any): CrpModel[] => {
  const data = payload?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.models)) return data.models;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

export default function Home() {
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [cameraJsonUrl, setCameraJsonUrl] = useState<string | null>(null);
  const [labelJsonData, setLabelJsonData] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [crpSearch, setCrpSearch] = useState('');
  const [crpResults, setCrpResults] = useState<CrpModel[]>([]);
  const [crpLoading, setCrpLoading] = useState(false);
  const [crpError, setCrpError] = useState('');
  const [crpStatus, setCrpStatus] = useState('');
  const [crpAudioUrl, setCrpAudioUrl] = useState<string | null>(null);
  const [crpFileName, setCrpFileName] = useState<string | null>(null);
  const cameraBlobUrlRef = useRef<string | null>(null);

  const handleCrpSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!crpSearch.trim()) return;
    const requestedName = /\.glb$/i.test(crpSearch.trim())
      ? crpSearch.trim()
      : `${crpSearch.trim()}.glb`;
    setCrpLoading(true);
    setCrpError('');
    setCrpStatus(`Finding ${requestedName}...`);
    try {
      const response = await fetch(`/api/crp/models?search=${encodeURIComponent(requestedName)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'CRP search failed.');
      const models = getCrpModels(payload).filter((model) => model.model_id);
      const exactModel = models.find(
        (model) => model.file_name?.toLocaleLowerCase() === requestedName.toLocaleLowerCase(),
      );
      if (exactModel) {
        setCrpResults([]);
        await handleCrpModelSelect(exactModel);
      } else {
        setCrpResults(models);
        setCrpStatus(models.length
          ? `Exact GLB not found; ${models.length} related model${models.length === 1 ? '' : 's'} found`
          : `No CRP model found for ${requestedName}`);
      }
    } catch (error) {
      setCrpResults([]);
      setCrpError(error instanceof Error ? error.message : 'CRP search failed.');
      setCrpStatus('');
    } finally {
      setCrpLoading(false);
    }
  };

  const handleCrpModelSelect = async (model: CrpModel) => {
    setCrpLoading(true);
    setCrpError('');
    setCrpStatus(`Loading ${model.file_name || model.model_name || 'model'}...`);
    try {
      const response = await fetch('/api/crp/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: model.model_id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'CRP model fetch failed.');
      const details = payload.data || payload;
      const fileName = details.file_name || model.file_name;
      const hasGlbUrl = details.download_url || details.signed_url || model.download_url || model.signed_url;
      if (!fileName || !hasGlbUrl) throw new Error('Selected CRP model has no GLB download URL.');
      // Stream through our same-origin server endpoint because CRP/R2 signed URLs
      // do not consistently include browser CORS headers.
      const glbUrl = `/api/crp/download?file_name=${encodeURIComponent(fileName)}&inline=1`;

      setModelUrl(glbUrl);
      setModelFile(null);
      setCrpFileName(fileName);
      const labels = details.meta_data?.labelData;
      setLabelJsonData(Array.isArray(labels) ? labels : null);
      const audioEntries = details.meta_data?.audio;
      const firstAudio = Array.isArray(audioEntries)
        ? audioEntries.find((audio: any) => audio?.signed_url)
        : null;
      setCrpAudioUrl(firstAudio?.signed_url || null);

      if (cameraBlobUrlRef.current) URL.revokeObjectURL(cameraBlobUrlRef.current);
      if (payload.cameraData?.keyframes) {
        const cameraUrl = URL.createObjectURL(new Blob(
          [JSON.stringify(payload.cameraData)],
          { type: 'application/json' },
        ));
        cameraBlobUrlRef.current = cameraUrl;
        setCameraJsonUrl(cameraUrl);
      } else {
        cameraBlobUrlRef.current = null;
        setCameraJsonUrl(null);
      }
      setCrpStatus(`Loaded ${details.file_name || model.file_name || 'CRP model'}`);
    } catch (error) {
      setCrpError(error instanceof Error ? error.message : 'CRP model fetch failed.');
    } finally {
      setCrpLoading(false);
    }
  };

  // Check URL parameters for auto-loading (IPR mode)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Check for GLB URL
    const requestedModel = params.get('model') || params.get('glb');
    if (requestedModel) {
      const glbUrl = normalizeModelUrl(requestedModel);
      setModelUrl(glbUrl);
      console.log('📦 Model detected from URL parameter:', glbUrl);

      // When explicit companion URLs are not supplied, discover them from the
      // GLB name: model.glb -> model_camera.json / model_labels.json.
      if (!params.get('cameraJson')) {
        const inferredCameraUrl = getCompanionAssetUrl(glbUrl, '_camera.json');
        if (inferredCameraUrl) {
          fetch(inferredCameraUrl)
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .then((data) => {
              if (Array.isArray(data?.keyframes)) {
                setCameraJsonUrl(inferredCameraUrl);
                console.log('🎥 Auto-detected camera JSON:', inferredCameraUrl);
              }
            })
            .catch(() => console.log('ℹ️ No optional camera JSON found for:', glbUrl));
        }
      }

      if (!params.get('labels')) {
        const inferredLabelsUrl = getCompanionAssetUrl(glbUrl, '_labels.json');
        if (inferredLabelsUrl) {
          fetch(inferredLabelsUrl)
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .then((data) => {
              if (Array.isArray(data)) {
                setLabelJsonData(data);
                console.log('🏷️ Auto-detected label/animation JSON:', inferredLabelsUrl);
              }
            })
            .catch(() => console.log('ℹ️ No optional label JSON found for:', glbUrl));
        }
      }
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
        <h1 className="text-4xl font-bold mb-2">Camera Animation Tool</h1>
        <p className="text-gray-400 mb-5">Fetch a CRP model or load a local 3D file</p>

        <form onSubmit={handleCrpSearch} className="w-full max-w-2xl mb-5">
          <div className="flex gap-2">
            <input
              value={crpSearch}
              onChange={(event) => setCrpSearch(event.target.value)}
              placeholder="Enter GLB name (extension optional)"
              className="flex-1 px-4 py-3 rounded-lg bg-gray-900 border border-cyan-600 text-white outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={crpLoading || !crpSearch.trim()}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded-lg"
            >
              {crpLoading ? 'Loading...' : 'Load GLB'}
            </button>
          </div>
          {crpError && <p className="text-red-400 text-sm mt-2">{crpError}</p>}
          {crpStatus && <p className="text-cyan-300 text-sm mt-2">{crpStatus}</p>}
          {crpResults.length > 0 && (
            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-gray-700 bg-black/70 text-left">
              {crpResults.map((model) => (
                <button
                  key={model.model_id}
                  type="button"
                  disabled={crpLoading}
                  onClick={() => handleCrpModelSelect(model)}
                  className="block w-full px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-cyan-950/70 disabled:opacity-50"
                >
                  <span className="block text-white">{model.file_name || model.model_name || model.model_id}</span>
                  {model.model_name && model.model_name !== model.file_name && (
                    <span className="block text-xs text-gray-400 mt-1">{model.model_name}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="flex items-center gap-3 mb-5 text-gray-500 text-sm">
          <span className="h-px w-24 bg-gray-700" /> OR <span className="h-px w-24 bg-gray-700" />
        </div>
        
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
        initialAudioUrl={crpAudioUrl || undefined}
        downloadFileName={crpFileName || undefined}
      />
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/20 border-4 border-blue-500 border-dashed pointer-events-none z-50 flex items-center justify-center">
          <p className="text-white text-2xl font-bold">Drop JSON file to load camera animation</p>
        </div>
      )}
    </div>
  );
}
