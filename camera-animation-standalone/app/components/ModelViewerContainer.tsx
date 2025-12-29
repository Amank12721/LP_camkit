'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelViewerElement } from '../types/model-viewer';
import CameraOrbitControls, { CameraKeyframe } from './CameraOrbitControls';
import CameraTimeline from './CameraTimeline';
import ModelAnnotations from './Annotation';

interface ModelViewerContainerProps {
  modelUrl: string;
  onChangeModel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  cameraJsonUrl?: string; // Optional URL to automatically load camera JSON
  labelData?: any; // Optional label JSON data for AR labels/hotspots
}

export default function ModelViewerContainer({ modelUrl, onChangeModel, cameraJsonUrl, labelData: initialLabelData }: ModelViewerContainerProps) {
  const modelViewerRef = useRef<ModelViewerElement | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [animationDuration, setAnimationDuration] = useState(0);
  const [cameraKeyframes, setCameraKeyframes] = useState<CameraKeyframe[]>([]);
  const [isCameraPlaybackEnabled, setIsCameraPlaybackEnabled] = useState(true);
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false);
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number | null>(null);
  const [isCameraControlsExpanded, setIsCameraControlsExpanded] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [labelData, setLabelData] = useState<any>(initialLabelData);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [fov] = useState<number>(45);
  const [exposureValue] = useState<number>(1);
  const [toneMapping] = useState<string>('commerce');
  const [toneMappingExposure] = useState<number>(1);
  const [labelScale, setLabelScale] = useState<number>(80); // Label size scale percentage (80% default)
  
  // Audio state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [audioVolume, setAudioVolume] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Update label data when initial prop changes
  useEffect(() => {
    if (initialLabelData) {
      setLabelData(initialLabelData);
      console.log('📥 Label data updated from props:', initialLabelData);
      console.log('📊 Label data length:', Array.isArray(initialLabelData) ? initialLabelData.length : 'not an array');
    }
  }, [initialLabelData]);

  // Handle label JSON import from camera controls
  const handleLabelJsonImport = useCallback((data: any) => {
    setLabelData(data);
    console.log('🏷️ Label data imported from camera controls:', data);
    console.log('📊 Label data length:', Array.isArray(data) ? data.length : 'not an array');
  }, []);

  // Handle audio file upload
  const handleAudioUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a)$/i))) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      
      // Create audio element
      const audio = new Audio(url);
      audio.volume = audioVolume;
      audio.loop = false;
      audioRef.current = audio;
      setAudioElement(audio);
      
      console.log('🔊 Audio loaded:', file.name);
      
      // Clean up old URL
      return () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
      };
    }
  }, [audioVolume, audioUrl]);

  // Remove audio
  const handleRemoveAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioElement(null);
    console.log('🔇 Audio removed');
  }, [audioUrl]);

  // Handle IPR camera JSON update (removed - not needed for offline)
  // Handle IPR label JSON update (removed - not needed for offline)

  // Debug: Log labelData state changes
  useEffect(() => {
    console.log('🔍 Current labelData state:', labelData);
    console.log('🔍 Is array?', Array.isArray(labelData));
    console.log('🔍 Length:', Array.isArray(labelData) ? labelData.length : 'N/A');
  }, [labelData]);

  // Process label data and create annotations with positions from model hierarchy
  useEffect(() => {
    if (!modelLoaded || !labelData || !Array.isArray(labelData) || labelData.length === 0) {
      if (!modelLoaded && labelData && Array.isArray(labelData) && labelData.length > 0) {
        console.log('⏳ Waiting for model to load before processing labels...');
      }
      return;
    }

    const mv = modelViewerRef.current;
    if (!mv) {
      console.log('⚠️ Model viewer ref not available');
      return;
    }

    // Add small delay to ensure model is fully loaded
    const timer = setTimeout(() => {
      console.log('🏷️ Processing label data with model hierarchy...');

      // Get model hierarchy using the same method as main app
      const hierarchySymbol = Object?.getOwnPropertySymbols(
        (mv as any)?.model,
      )?.find((symbol) => symbol?.description === 'hierarchy');

      if (!hierarchySymbol) {
        console.log('⚠️ Hierarchy symbol not found in model');
        return;
      }

      const hierarchy = (mv as any)?.model[hierarchySymbol as symbol];
      
      if (!Array?.isArray(hierarchy)) {
        console.error('❌ Hierarchy is not an array');
        return;
      }
      console.log(`📦 Found ${hierarchy.length} nodes in model hierarchy`);
      
      // Log first few node names for debugging
      if (hierarchy.length > 0) {
        console.log('📝 Sample node names:', hierarchy.slice(0, 10).map(n => n.name));
      }

      // Find label nodes and match with label data
      const labelNodes = hierarchy.filter((node) => node?.name?.startsWith('label-'));
      console.log(`🏷️ Found ${labelNodes.length} label nodes in model`);
      
      if (labelNodes.length > 0) {
        console.log('📝 Label node names:', labelNodes.map(n => n.name));
        console.log('📊 Label data IDs:', labelData.map((l: any) => l.id));
      }

      // Process label nodes exactly like main app
      const newAnnotations = labelNodes
        .map((node) => {
          const idStr = node?.name?.substring(6);
          const id = parseInt(idStr, 10);

          const matchingLabelData = labelData.find(
            (item: any) => item.id === id,
          );

          if (matchingLabelData) {
            const meshPosition = node?.mesh?.position ?? node?.position;
            const position = {
              x: meshPosition?.x ?? 0,
              y: meshPosition?.y ?? 0,
              z: meshPosition?.z ?? 0,
            };

            const appearFrame =
              matchingLabelData?.animation?.frame?.first_value;
            const disappearFrame =
              matchingLabelData?.animation?.frame?.second_value;

            const primaryText =
              matchingLabelData?.text?.find((t: any) => t.lang === 'en') ||
              matchingLabelData?.text[0];
            const labelText = primaryText?.text || `Label ${id}`;

            console.log(`✅ Matched label ${id} "${labelText}" at position:`, position);
            console.log(`   appearFrame: ${appearFrame}, disappearFrame: ${disappearFrame}`);

            return {
              label: labelText,
              position,
              appearFrame,
              disappearFrame,
              isVisible: false, // Start hidden (will be controlled by frame visibility in Annotation component)
            };
          }
          return null;
        })
        .filter(Boolean);

      setAnnotations(newAnnotations as any[]);
      console.log(`✅ Created ${newAnnotations.length} annotations`);
      console.log('📍 Annotation positions:', newAnnotations.map((a: any) => ({ label: a?.label, pos: a?.position })));
    }, 500); // 500ms delay to ensure model is ready

    return () => clearTimeout(timer);
  }, [labelData, modelLoaded]);

  // Progress bar styles to match lpdev
  const progressBarStyles = `
    model-viewer::part(default-progress-bar) {
      height: 8px;
      background-color: rgba(255, 100, 20, 1);
    }
  `;

  // Handle model load and get animation duration
  useEffect(() => {
    const mv = modelViewerRef.current;
    if (!mv) return;

    const handleLoad = () => {
      setModelLoaded(true);
      
      // Pause the model initially (we'll control playback via timeline)
      if (mv.pause) {
        mv.pause();
      }
      
      // Get animation duration from model
      const checkDuration = () => {
        const duration = mv.duration;
        if (duration && isFinite(duration) && duration > 0) {
          setAnimationDuration(duration);
        } else {
          // If no animation, set a default duration for camera animation
          setAnimationDuration(10);
        }
      };
      
      // Check immediately and after a short delay
      checkDuration();
      setTimeout(checkDuration, 100);
    };

    mv.addEventListener('load', handleLoad);
    return () => mv.removeEventListener('load', handleLoad);
  }, [modelUrl]);

  // Global function for timeline to update keyframe positions
  useEffect(() => {
    (window as any).updateKeyframePosition = (index: number, newFrame: number) => {
      setCameraKeyframes((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          frame: newFrame,
          time: parseFloat((newFrame / 24).toFixed(2)),
        };
        // Re-sort by frame
        return updated.sort((a, b) => a.frame - b.frame);
      });
    };
    
    return () => {
      delete (window as any).updateKeyframePosition;
    };
  }, []);

  // Auto-load camera JSON if URL is provided
  useEffect(() => {
    if (!cameraJsonUrl || !modelLoaded) return;

    const loadCameraJson = async () => {
      try {
        console.log('🎥 Auto-loading camera JSON from:', cameraJsonUrl);
        const response = await fetch(cameraJsonUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.keyframes && Array.isArray(data.keyframes)) {
          const importedKeyframes: CameraKeyframe[] = data.keyframes.map((kf: any, idx: number) => ({
            id: `kf-auto-${Date.now()}-${idx}`,
            frame: kf.frame,
            time: kf.time,
            theta: kf.properties.theta[0] || 0,
            phi: kf.properties.phi[0] || 75,
            radius: kf.properties.radius[0] || 105,
            targetX: kf.properties.targetX[0] || 0,
            targetY: kf.properties.targetY[0] || 0,
            targetZ: kf.properties.targetZ[0] || 0,
            fov: kf.properties.fov[0] || 45,
            name: kf.name || 'Auto-loaded Keyframe',
          }));
          
          setCameraKeyframes(importedKeyframes);
          setIsCameraControlsExpanded(true); // Auto-expand controls when JSON is loaded
          console.log(`✅ Auto-loaded ${importedKeyframes.length} keyframes from JSON`);
        }
      } catch (error) {
        console.error('❌ Failed to auto-load camera JSON:', error);
      }
    };

    loadCameraJson();
  }, [cameraJsonUrl, modelLoaded]);

  // Listen to model's time updates to sync timeline
  useEffect(() => {
    const mv = modelViewerRef.current;
    if (!mv || animationDuration === 0) return;

    const fps = 24;
    const totalFrames = Math.ceil(animationDuration * fps);
    let animationFrameId: number;
    let lastFrame = -1;

    const updateFrame = () => {
      const currentTime = mv.currentTime || 0;
      const frame = Math.floor((currentTime / animationDuration) * totalFrames);
      
      // Only update if frame actually changed
      if (frame !== lastFrame) {
        lastFrame = frame;
        setCurrentFrame(frame);
        
        // Sync audio during playback
        if (audioRef.current && isAnimationPlaying) {
          const audioTime = audioRef.current.currentTime;
          const timeDiff = Math.abs(audioTime - currentTime);
          
          // Resync if audio drifts more than 0.1 seconds
          if (timeDiff > 0.1) {
            audioRef.current.currentTime = currentTime;
          }
        }
      }

      // Check if animation ended
      if (currentTime >= animationDuration && isAnimationPlaying) {
        setIsAnimationPlaying(false);
        if (mv.pause) {
          mv.pause();
        }
        // Pause audio
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }

      animationFrameId = requestAnimationFrame(updateFrame);
    };

    animationFrameId = requestAnimationFrame(updateFrame);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [animationDuration, isAnimationPlaying]);

  const handleCameraTimelineSeek = useCallback((frame: number) => {
    setCurrentFrame(frame);
    
    // Update model animation time with requestAnimationFrame for smoothness
    const mv = modelViewerRef.current;
    if (mv && animationDuration > 0) {
      requestAnimationFrame(() => {
        const fps = 24;
        const totalFrames = Math.ceil(animationDuration * fps);
        const time = (frame / totalFrames) * animationDuration;
        mv.currentTime = time;
        
        // Sync audio to timeline position (works during scrubbing)
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(time, audioRef.current.duration || time);
        }
      });
    }
  }, [animationDuration]);

  const handleTimelinePlayToggle = useCallback(() => {
    setIsAnimationPlaying((prev) => {
      const newState = !prev;
      const mv = modelViewerRef.current;
      
      if (mv) {
        if (newState && mv.play) {
          mv.play();
          // Play audio synced with animation
          if (audioRef.current) {
            const fps = 24;
            const totalFrames = Math.ceil(animationDuration * fps);
            const time = (currentFrame / totalFrames) * animationDuration;
            audioRef.current.currentTime = time;
            audioRef.current.play().catch(err => console.error('Audio play failed:', err));
          }
        } else if (!newState && mv.pause) {
          mv.pause();
          // Pause audio
          if (audioRef.current) {
            audioRef.current.pause();
          }
        }
      }
      
      return newState;
    });
  }, [animationDuration, currentFrame]);

  // Handle JSON file upload
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        if (data.keyframes && Array.isArray(data.keyframes)) {
          // Convert imported keyframes
          const importedKeyframes: CameraKeyframe[] = data.keyframes.map((kf: any, idx: number) => ({
            id: `kf-imported-${Date.now()}-${idx}`,
            frame: kf.frame,
            time: kf.time,
            theta: kf.properties.theta[0] || 0,
            phi: kf.properties.phi[0] || 75,
            radius: kf.properties.radius[0] || 105,
            targetX: kf.properties.targetX[0] || 0,
            targetY: kf.properties.targetY[0] || 0,
            targetZ: kf.properties.targetZ[0] || 0,
            fov: kf.properties.fov[0] || 45,
            name: kf.name || 'Imported Keyframe',
          }));
          
          setCameraKeyframes(importedKeyframes);
          console.log(`✅ Loaded ${importedKeyframes.length} keyframes from JSON`);
          
          // Expand camera controls to show loaded keyframes
          setIsCameraControlsExpanded(true);
        }
      } catch (error) {
        console.error('❌ Failed to load JSON:', error);
        alert('Failed to load camera JSON file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="relative w-screen h-screen">
      {/* Progress bar styling */}
      <style>{progressBarStyles}</style>

      {/* Model Viewer - EXACT same config as lpdev */}
      <model-viewer
        ref={modelViewerRef as any}
        src={modelUrl}
        alt="3D model viewer"
        environment-image="/2k.hdr"
        camera-controls
        exposure={exposureValue.toString()}
        shadow-intensity="0.09"
        shadow-softness=".5"
        animation-name="default"
        tone-mapping={toneMapping}
        tone-mapping-exposure={toneMappingExposure.toString()}
        color-space="srgb"
        camera-orbit="5deg 80deg 20m"
        exposure-compensation="0.5"
        environment-intensity="1.0"
        emissive-strength="2.0"
        disable-tap
        ar
        ar-modes="webxr scene-viewer quick-look"
        ar-scale="auto"
        ar-placement="floor"
        interaction-prompt="auto"
        min-field-of-view="1deg"
        max-field-of-view="180deg"
        field-of-view={`${fov}deg`}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Render annotations/labels */}
        {annotations.length > 0 && (
          <ModelAnnotations
            annotations={annotations}
            currentFrame={currentFrame}
            labelScale={labelScale}
          />
        )}
      </model-viewer>

      {/* Top Bar - Left Side */}
      <div className="absolute top-4 left-4 z-50 flex gap-2">
        <label className="px-4 py-2 bg-black/50 hover:bg-black/70 text-white border border-blue-500/50 rounded-lg cursor-pointer transition-colors">
          📁 Change Model
          <input
            type="file"
            accept=".glb,.gltf"
            onChange={onChangeModel}
            className="hidden"
          />
        </label>
        
        <label className="px-4 py-2 bg-black/50 hover:bg-black/70 text-white border border-purple-500/50 rounded-lg cursor-pointer transition-colors">
          🎬 Load Camera JSON
          <input
            type="file"
            accept=".json"
            onChange={handleJsonUpload}
            className="hidden"
          />
        </label>

        <label className="px-4 py-2 bg-black/50 hover:bg-black/70 text-white border border-orange-500/50 rounded-lg cursor-pointer transition-colors">
          🔊 Load Audio
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a"
            onChange={handleAudioUpload}
            className="hidden"
          />
        </label>

        {audioUrl && (
          <button
            onClick={handleRemoveAudio}
            className="px-4 py-2 bg-red-600/50 hover:bg-red-600/70 text-white border border-red-500 rounded-lg transition-colors"
            title="Remove audio"
          >
            🔇 Remove Audio
          </button>
        )}
      </div>

      {/* Top Bar - Right Side - Label & Audio Controls */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
        {labelData && Array.isArray(labelData) && labelData.length > 0 && (
          <>
            <div className="px-4 py-2 bg-green-600/30 border-2 border-green-500 rounded-lg shadow-lg backdrop-blur-sm">
              <span className="text-green-300 text-sm font-bold">
                🏷️ {labelData.length} Labels Loaded
              </span>
            </div>
            
            {/* Label Size Slider */}
            <div className="px-4 py-3 bg-black/50 border border-purple-500/50 rounded-lg shadow-lg backdrop-blur-sm">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-medium">Label Size</span>
                  <span className="text-purple-300 text-xs font-bold">{labelScale}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="150"
                  value={labelScale}
                  onChange={(e) => setLabelScale(Number(e.target.value))}
                  className="w-40 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </>
        )}

        {/* Audio Volume Control */}
        {audioUrl && (
          <div className="px-4 py-3 bg-black/50 border border-orange-500/50 rounded-lg shadow-lg backdrop-blur-sm">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-white text-xs font-medium">🔊 Volume</span>
                <span className="text-orange-300 text-xs font-bold">{Math.round(audioVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={audioVolume}
                onChange={(e) => {
                  const vol = Number(e.target.value);
                  setAudioVolume(vol);
                  if (audioRef.current) {
                    audioRef.current.volume = vol;
                  }
                }}
                className="w-40 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Camera Controls */}
      <CameraOrbitControls
        modelViewer={modelViewerRef?.current}
        isPortrait={false}
        className="absolute left-4 top-20 z-50"
        currentFrame={currentFrame}
        duration={animationDuration}
        fps={24}
        onKeyframesChange={setCameraKeyframes}
        isPlaying={isAnimationPlaying}
        selectedKeyframeIndex={selectedKeyframeIndex}
        onSelectedKeyframeChange={setSelectedKeyframeIndex}
        onExpandedChange={setIsCameraControlsExpanded}
        onLabelJsonImport={handleLabelJsonImport}
      />

      {/* Timeline */}
      {isCameraControlsExpanded && animationDuration > 0 && (
        <CameraTimeline
          currentFrame={currentFrame}
          duration={animationDuration}
          fps={24}
          keyframes={cameraKeyframes}
          isPlaying={isAnimationPlaying}
          cameraPlaybackEnabled={isCameraPlaybackEnabled}
          onSeek={handleCameraTimelineSeek}
          onKeyframeClick={(keyframe, index) => setSelectedKeyframeIndex(index)}
          onToggleCameraPlayback={() => setIsCameraPlaybackEnabled(!isCameraPlaybackEnabled)}
          onTogglePlay={handleTimelinePlayToggle}
          selectedKeyframeIndex={selectedKeyframeIndex}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-5xl"
        />
      )}
    </div>
  );
}
