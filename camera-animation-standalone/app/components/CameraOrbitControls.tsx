'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Camera, RotateCw, Copy, RefreshCw, Plus, Download, Upload, Check, Trash2 } from 'lucide-react';
import { ModelViewerElement } from '../types/model-viewer';

interface CameraKeyframe {
  id?: string; // Unique identifier for React keys
  frame: number;
  time: number;
  theta: number;
  phi: number;
  radius: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  fov: number;
  name: string;
}

interface CameraOrbitControlsProps {
  modelViewer: ModelViewerElement | null;
  isPortrait?: boolean;
  className?: string;
  currentFrame?: number;
  duration?: number;
  fps?: number;
  onKeyframesChange?: (keyframes: CameraKeyframe[]) => void;
  isPlaying?: boolean;
  selectedKeyframeIndex?: number | null;
  onSelectedKeyframeChange?: (index: number | null) => void;
  onExpandedChange?: (expanded: boolean) => void;
  onLabelJsonImport?: (labelData: any) => void;
}

const CameraOrbitControls: React.FC<CameraOrbitControlsProps> = ({
  modelViewer,
  isPortrait = false,
  className = '',
  currentFrame = 0,
  duration = 0,
  fps = 24,
  onKeyframesChange,
  isPlaying = false,
  selectedKeyframeIndex: externalSelectedIndex = null,
  onSelectedKeyframeChange,
  onExpandedChange,
  onLabelJsonImport,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Notify parent when expanded state changes
  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [cameraPlaybackEnabled, setCameraPlaybackEnabled] = useState(true);
  const [isAdjustingSliders, setIsAdjustingSliders] = useState(false);
  
  // Use external selection if provided, otherwise use internal state
  const selectedKeyframeIndex = externalSelectedIndex;
  const setSelectedKeyframeIndex = (index: number | null) => {
    onSelectedKeyframeChange?.(index);
  };
  
  // Show feedback message
  const showFeedback = (message: string) => {
    setFeedbackMessage(message);
    setTimeout(() => setFeedbackMessage(''), 2000);
  };
  
  // Camera Orbit values - will be initialized from model-viewer
  const [theta, setTheta] = useState(5);
  const [phi, setPhi] = useState(80);
  const [radius, setRadius] = useState(105);
  
  // Camera Target values
  const [targetX, setTargetX] = useState(0);
  const [targetY, setTargetY] = useState(0);
  const [targetZ, setTargetZ] = useState(0);
  
  // FOV value and range
  const [fov, setFov] = useState(45);
  const [fovMin, setFovMin] = useState(1);
  const [fovMax, setFovMax] = useState(180);
  
  // Radius range
  const [radiusMin, setRadiusMin] = useState(10);
  const [radiusMax, setRadiusMax] = useState(500);
  
  // Camera orbit limits (for model-viewer attributes)
  const [orbitLimitsEnabled, setOrbitLimitsEnabled] = useState(false);
  const [minOrbitRadius, setMinOrbitRadius] = useState(0.5); // meters
  const [maxOrbitRadius, setMaxOrbitRadius] = useState(100); // meters
  
  // Camera movement smoothness
  const [interpolationDecay, setInterpolationDecay] = useState(100); // Default is 100ms
  
  // Current running values from model-viewer
  const [currentTheta, setCurrentTheta] = useState(5);
  const [currentPhi, setCurrentPhi] = useState(80);
  const [currentRadius, setCurrentRadius] = useState(105);
  const [currentTargetX, setCurrentTargetX] = useState(0);
  const [currentTargetY, setCurrentTargetY] = useState(0);
  const [currentTargetZ, setCurrentTargetZ] = useState(0);
  const [currentFov, setCurrentFov] = useState(45);
  
  // Track if we've initialized from model-viewer
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Keyframes
  const [keyframes, setKeyframes] = useState<CameraKeyframe[]>([]);
  const [keyframeName, setKeyframeName] = useState('Keyframe');

  // Helper to ensure all keyframes have IDs
  const ensureKeyframeIds = (kfs: CameraKeyframe[]): CameraKeyframe[] => {
    return kfs.map((kf, idx) => ({
      ...kf,
      id: kf.id || `kf-${Date.now()}-${idx}-${Math.random()}`,
    }));
  };

  // Initialize slider values from model-viewer on first load
  useEffect(() => {
    if (!modelViewer || hasInitialized) return;
    
    try {
      let roundedTheta = 5, roundedPhi = 80, roundedRadius = 105;
      
      // Read initial camera orbit from model-viewer
      const orbit = (modelViewer as any).getCameraOrbit();
      if (orbit) {
        const thetaDeg = (orbit.theta * 180 / Math.PI);
        const phiDeg = (orbit.phi * 180 / Math.PI);
        const radiusPercent = orbit.radius * 5; // Convert meters to percentage (20m = 100%)
        
        // Set both slider and current values
        roundedTheta = Math.round(thetaDeg);
        roundedPhi = Math.round(phiDeg);
        roundedRadius = Math.round(radiusPercent);
        
        setTheta(roundedTheta);
        setPhi(roundedPhi);
        setRadius(roundedRadius);
        setCurrentTheta(roundedTheta);
        setCurrentPhi(roundedPhi);
        setCurrentRadius(roundedRadius);
      }
      
      // Read initial camera target
      const target = (modelViewer as any).getCameraTarget();
      if (target) {
        const roundedX = parseFloat(target.x.toFixed(1));
        const roundedY = parseFloat(target.y.toFixed(1));
        const roundedZ = parseFloat(target.z.toFixed(1));
        
        setTargetX(roundedX);
        setTargetY(roundedY);
        setTargetZ(roundedZ);
        setCurrentTargetX(roundedX);
        setCurrentTargetY(roundedY);
        setCurrentTargetZ(roundedZ);
      }
      
      // Read initial FOV
      const fovValue = (modelViewer as any).getFieldOfView ? (modelViewer as any).getFieldOfView() : 45;
      const roundedFov = Math.round(fovValue);
      setFov(roundedFov);
      setCurrentFov(roundedFov);
      
      setHasInitialized(true);
      console.log('✅ Initialized camera controls from model-viewer:', { theta: roundedTheta, phi: roundedPhi, radius: roundedRadius });
    } catch (error) {
      console.error('Error initializing camera values:', error);
    }
  }, [modelViewer, hasInitialized]);

  // Read current values from model-viewer
  const readCurrentValues = useCallback(() => {
    if (!modelViewer) return;
    
    try {
      // Read camera orbit
      const orbit = (modelViewer as any).getCameraOrbit();
      if (orbit) {
        const thetaDeg = (orbit.theta * 180 / Math.PI);
        const phiDeg = (orbit.phi * 180 / Math.PI);
        const radiusPercent = orbit.radius * 5; // Convert meters to percentage (20m = 100%)
        
        setCurrentTheta(Math.round(thetaDeg));
        setCurrentPhi(Math.round(phiDeg));
        setCurrentRadius(Math.round(radiusPercent));
      }
      
      // Read camera target
      const target = (modelViewer as any).getCameraTarget();
      if (target) {
        setCurrentTargetX(parseFloat(target.x.toFixed(1)));
        setCurrentTargetY(parseFloat(target.y.toFixed(1)));
        setCurrentTargetZ(parseFloat(target.z.toFixed(1)));
      }
      
      // Read FOV
      const fovValue = (modelViewer as any).getFieldOfView ? (modelViewer as any).getFieldOfView() : 45;
      setCurrentFov(Math.round(fovValue));
    } catch (error) {
      console.error('Error reading camera values:', error);
    }
  }, [modelViewer]);

  // Update model-viewer when values change
  useEffect(() => {
    if (modelViewer && isExpanded) {
      // Only apply when panel is expanded
      modelViewer.setAttribute('camera-orbit', `${theta}deg ${phi}deg ${radius}%`);
      modelViewer.cameraOrbit = `${theta}deg ${phi}deg ${radius}%`;
    }
  }, [modelViewer, theta, phi, radius, isExpanded]);

  useEffect(() => {
    if (modelViewer && isExpanded) {
      modelViewer.setAttribute('camera-target', `${targetX}m ${targetY}m ${targetZ}m`);
      modelViewer.cameraTarget = `${targetX}m ${targetY}m ${targetZ}m`;
    }
  }, [modelViewer, targetX, targetY, targetZ, isExpanded]);
  
  useEffect(() => {
    if (modelViewer && isExpanded) {
      modelViewer.setAttribute('field-of-view', `${fov}deg`);
      modelViewer.fieldOfView = `${fov}deg`;
    }
  }, [modelViewer, fov, isExpanded]);

  // Apply camera orbit limits to model-viewer
  useEffect(() => {
    if (modelViewer && isExpanded) {
      if (orbitLimitsEnabled) {
        modelViewer.setAttribute('min-camera-orbit', `auto auto ${minOrbitRadius}m`);
        modelViewer.setAttribute('max-camera-orbit', `auto auto ${maxOrbitRadius}m`);
        console.log(`🔒 Applied orbit limits: ${minOrbitRadius}m - ${maxOrbitRadius}m`);
      } else {
        modelViewer.removeAttribute('min-camera-orbit');
        modelViewer.removeAttribute('max-camera-orbit');
        console.log('🔓 Removed orbit limits');
      }
    }
  }, [modelViewer, isExpanded, orbitLimitsEnabled, minOrbitRadius, maxOrbitRadius]);

  // Apply interpolation decay (camera movement smoothness)
  useEffect(() => {
    if (modelViewer && isExpanded) {
      modelViewer.setAttribute('interpolation-decay', interpolationDecay.toString());
      console.log(`🎬 Applied interpolation decay: ${interpolationDecay}ms`);
    }
  }, [modelViewer, isExpanded, interpolationDecay]);

  // Read initial values and set up interval to update current values
  useEffect(() => {
    if (modelViewer && isExpanded) {
      readCurrentValues();
      
      // Update current values periodically
      const interval = setInterval(readCurrentValues, 500);
      
      return () => clearInterval(interval);
    }
  }, [modelViewer, isExpanded, readCurrentValues]);

  const handleReset = () => {
    setTheta(5);
    setPhi(80);
    setRadius(105);
    setTargetX(0);
    setTargetY(0);
    setTargetZ(0);
    setFov(45);
  };
  
  const handleReadCurrent = () => {
    if (!modelViewer) return;
    
    // Set slider values to current running values
    setTheta(currentTheta);
    setPhi(currentPhi);
    setRadius(currentRadius);
    setTargetX(currentTargetX);
    setTargetY(currentTargetY);
    setTargetZ(currentTargetZ);
    setFov(currentFov);
  };

  const handleCopy = () => {
    const orbitString = `camera-orbit="${theta}deg ${phi}deg ${radius}%"`;
    const targetString = `camera-target="${targetX}m ${targetY}m ${targetZ}m"`;
    const fovString = `field-of-view="${fov}deg"`;
    const fullString = `${orbitString}\n${targetString}\n${fovString}`;
    
    navigator.clipboard.writeText(fullString).then(() => {
      alert('Camera values copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const handleDuplicateKeyframe = (index: number) => {
    if (index < 0 || index >= keyframes.length) return;
    
    const keyframeToCopy = keyframes[index];
    const newKeyframe: CameraKeyframe = {
      ...keyframeToCopy,
      id: `kf-${Date.now()}-${Math.random()}`, // New unique ID
      frame: currentFrame, // Place at current frame
      time: duration > 0 ? (currentFrame / fps) : 0,
      name: `${keyframeToCopy.name} (Copy)`,
    };
    
    // Remember the selected keyframe's frame number
    const selectedFrame = selectedKeyframeIndex !== null ? keyframes[selectedKeyframeIndex]?.frame : null;
    
    // Add and sort keyframes by frame number
    const updatedKeyframes = [...keyframes, newKeyframe].sort((a, b) => a.frame - b.frame);
    setKeyframes(updatedKeyframes);
    onKeyframesChange?.(updatedKeyframes);
    
    // Update selected index if a keyframe was selected (find its new position after sorting)
    if (selectedFrame !== null) {
      const newIndex = updatedKeyframes.findIndex(kf => kf.frame === selectedFrame);
      if (newIndex !== -1) {
        setSelectedKeyframeIndex(newIndex);
      }
    }
    
    showFeedback(`📋 Duplicated: ${keyframeToCopy.name} at frame ${currentFrame}`);
  };
  
  const handleRecordKeyframe = useCallback(() => {
    const currentTime = duration > 0 ? (currentFrame / fps) : 0;
    
    // Check if a keyframe already exists at this frame
    const existingIndex = keyframes.findIndex(kf => kf.frame === currentFrame);
    
    if (existingIndex !== -1) {
      // Replace existing keyframe at this frame
      const updatedKeyframes = [...keyframes];
      updatedKeyframes[existingIndex] = {
        id: keyframes[existingIndex].id, // Keep the original ID
        frame: currentFrame,
        time: currentTime,
        theta: currentTheta,
        phi: currentPhi,
        radius: currentRadius,
        targetX: currentTargetX,
        targetY: currentTargetY,
        targetZ: currentTargetZ,
        fov: currentFov,
        name: keyframes[existingIndex].name, // Keep the original name
      };
      setKeyframes(updatedKeyframes);
      onKeyframesChange?.(updatedKeyframes);
      showFeedback(`🔄 Updated: ${keyframes[existingIndex].name} at frame ${currentFrame}`);
    } else {
      // Add new keyframe
      const newKeyframe: CameraKeyframe = {
        id: `kf-${Date.now()}-${Math.random()}`, // Unique ID
        frame: currentFrame,
        time: currentTime,
        theta: currentTheta,
        phi: currentPhi,
        radius: currentRadius,
        targetX: currentTargetX,
        targetY: currentTargetY,
        targetZ: currentTargetZ,
        fov: currentFov,
        name: `${keyframeName} ${keyframes.length + 1}`,
      };
      
      // If a keyframe is selected, remember its frame number
      const selectedFrame = selectedKeyframeIndex !== null ? keyframes[selectedKeyframeIndex]?.frame : null;
      
      // Add and sort keyframes by frame number
      const updatedKeyframes = ensureKeyframeIds([...keyframes, newKeyframe].sort((a, b) => a.frame - b.frame));
      setKeyframes(updatedKeyframes);
      onKeyframesChange?.(updatedKeyframes);
      
      // Update selected index if a keyframe was selected (find its new position after sorting)
      if (selectedFrame !== null) {
        const newIndex = updatedKeyframes.findIndex(kf => kf.frame === selectedFrame);
        if (newIndex !== -1) {
          setSelectedKeyframeIndex(newIndex);
        }
      }
      
      console.log('🎬 Keyframe recorded:', newKeyframe);
      
      showFeedback(`🎬 Keyframe ${keyframes.length + 1} recorded at frame ${currentFrame}`);
    }
  }, [currentFrame, duration, fps, currentTheta, currentPhi, currentRadius, currentTargetX, currentTargetY, currentTargetZ, currentFov, keyframeName, keyframes, onKeyframesChange]);
  
  const handleDeleteKeyframe = (index: number) => {
    const deletedKeyframe = keyframes[index];
    const updatedKeyframes = keyframes.filter((_, i) => i !== index);
    setKeyframes(updatedKeyframes);
    onKeyframesChange?.(updatedKeyframes);
    
    // Clear selection if the deleted keyframe was selected
    if (selectedKeyframeIndex === index) {
      setSelectedKeyframeIndex(null);
    } else if (selectedKeyframeIndex !== null && selectedKeyframeIndex > index) {
      // Adjust selection index if a keyframe before the selected one was deleted
      setSelectedKeyframeIndex(selectedKeyframeIndex - 1);
    }
    
    showFeedback(`🗑️ Deleted: ${deletedKeyframe.name}`);
  };
  
  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (data.keyframes && Array.isArray(data.keyframes)) {
          // Convert imported keyframes
          const importedKeyframes: CameraKeyframe[] = data.keyframes.map((kf: any, idx: number) => ({
            id: `kf-imported-${Date.now()}-${idx}`, // Assign unique ID
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
          
          const keyframesWithIds = ensureKeyframeIds(importedKeyframes);
          setKeyframes(keyframesWithIds);
          onKeyframesChange?.(keyframesWithIds);
          
          // Load camera settings if available
          if (data.cameraSettings) {
            const settings = data.cameraSettings;
            
            // FOV Range
            if (settings.fovRange) {
              setFovMin(settings.fovRange.min || 1);
              setFovMax(settings.fovRange.max || 180);
            }
            
            // Radius Range
            if (settings.radiusRange) {
              setRadiusMin(settings.radiusRange.min || 10);
              setRadiusMax(settings.radiusRange.max || 500);
            }
            
            // Orbit Limits
            if (settings.orbitLimits) {
              setOrbitLimitsEnabled(settings.orbitLimits.enabled || false);
              setMinOrbitRadius(settings.orbitLimits.minDistance || 0.5);
              setMaxOrbitRadius(settings.orbitLimits.maxDistance || 100);
            }
            
            // Interpolation Decay
            if (settings.interpolationDecay !== undefined) {
              setInterpolationDecay(settings.interpolationDecay);
            }
            
            console.log('⚙️ Loaded camera settings:', settings);
          }
          
          showFeedback(`📥 Imported ${importedKeyframes.length} keyframes + settings`);
          
          console.log('📥 Imported keyframes:', importedKeyframes);
        } else {
          throw new Error('Invalid camera animation format');
        }
      } catch (error) {
        console.error('Import error:', error);
        showFeedback('❌ Import failed: Invalid JSON format');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  const handleLabelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Check if it's a valid label JSON (array with id fields)
        if (Array.isArray(data) && data.length > 0) {
          onLabelJsonImport?.(data);
          showFeedback(`🏷️ Imported ${data.length} labels`);
          console.log('🏷️ Imported label data:', data);
        } else {
          throw new Error('Invalid label JSON format');
        }
      } catch (error) {
        console.error('Label import error:', error);
        showFeedback('❌ Label import failed: Invalid JSON format');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };
  
  const handleExportJSON = () => {
    if (keyframes.length === 0) {
      showFeedback('⚠️ No keyframes to export');
      return;
    }
    
    // Sort keyframes by frame
    const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);
    
    // Convert to camera animation JSON format
    const animationData = {
      currentCameraState: {
        theta: currentTheta,
        phi: currentPhi,
        radius: currentRadius,
        targetX: currentTargetX,
        targetY: currentTargetY,
        targetZ: currentTargetZ,
        fov: currentFov,
      },
      keyframes: sortedKeyframes.map((kf) => ({
        frame: kf.frame,
        time: kf.time,
        name: kf.name,
        properties: {
          theta: [kf.theta],
          phi: [kf.phi],
          radius: [kf.radius],
          targetX: [kf.targetX],
          targetY: [kf.targetY],
          targetZ: [kf.targetZ],
          fov: [kf.fov],
        },
      })),
      animationSettings: {
        fps: fps,
        duration: duration,
        autoKeyframe: false,
      },
      cameraSettings: {
        fovRange: {
          min: fovMin,
          max: fovMax,
        },
        radiusRange: {
          min: radiusMin,
          max: radiusMax,
        },
        orbitLimits: {
          enabled: orbitLimitsEnabled,
          minDistance: minOrbitRadius,
          maxDistance: maxOrbitRadius,
        },
        interpolationDecay: interpolationDecay,
      },
      metadata: {
        version: '1.1',
        creator: 'LearningPad 3D Web Camera Controls',
        timestamp: new Date().toISOString(),
        totalKeyframes: sortedKeyframes.length,
      },
    };
    
    // Download JSON
    const json = JSON.stringify(animationData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `camera-animation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('💾 Camera animation exported:', animationData);
    
    showFeedback(`💾 Exported ${sortedKeyframes.length} keyframes`);
  };
  
  // Camera playback - apply interpolated values based on current frame
  useEffect(() => {
    // Don't apply camera playback when user is actively adjusting sliders
    if (!modelViewer || !cameraPlaybackEnabled || keyframes.length === 0 || isAdjustingSliders) {
      return;
    }

    // Sort keyframes by frame
    const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

    // Check if we're exactly on a keyframe
    const exactKeyframe = sortedKeyframes.find(kf => kf.frame === currentFrame);
    
    if (exactKeyframe) {
      // Use exact keyframe values (no interpolation)
      modelViewer.cameraOrbit = `${exactKeyframe.theta}deg ${exactKeyframe.phi}deg ${exactKeyframe.radius}%`;
      modelViewer.cameraTarget = `${exactKeyframe.targetX}m ${exactKeyframe.targetY}m ${exactKeyframe.targetZ}m`;
      modelViewer.fieldOfView = `${exactKeyframe.fov}deg`;
      return;
    }

    // Find surrounding keyframes for current frame
    let prevKeyframe: CameraKeyframe | null = null;
    let nextKeyframe: CameraKeyframe | null = null;

    for (let i = 0; i < sortedKeyframes.length; i++) {
      if (sortedKeyframes[i].frame <= currentFrame) {
        prevKeyframe = sortedKeyframes[i];
      }
      if (sortedKeyframes[i].frame > currentFrame && !nextKeyframe) {
        nextKeyframe = sortedKeyframes[i];
        break;
      }
    }

    // If we have keyframes, apply interpolation
    if (prevKeyframe && nextKeyframe) {
      // Interpolate between keyframes
      const frameDelta = nextKeyframe.frame - prevKeyframe.frame;
      const t = frameDelta > 0 ? (currentFrame - prevKeyframe.frame) / frameDelta : 0;

      // Linear interpolation
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      
      // Angular interpolation for theta (handles 360° wrap)
      const lerpAngle = (a: number, b: number, t: number) => {
        let diff = b - a;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return a + diff * t;
      };

      const interpolatedTheta = lerpAngle(prevKeyframe.theta, nextKeyframe.theta, t);
      const interpolatedPhi = lerp(prevKeyframe.phi, nextKeyframe.phi, t);
      const interpolatedRadius = lerp(prevKeyframe.radius, nextKeyframe.radius, t);
      const interpolatedTargetX = lerp(prevKeyframe.targetX, nextKeyframe.targetX, t);
      const interpolatedTargetY = lerp(prevKeyframe.targetY, nextKeyframe.targetY, t);
      const interpolatedTargetZ = lerp(prevKeyframe.targetZ, nextKeyframe.targetZ, t);
      const interpolatedFov = lerp(prevKeyframe.fov, nextKeyframe.fov, t);

      // Apply to model-viewer
      modelViewer.cameraOrbit = `${interpolatedTheta}deg ${interpolatedPhi}deg ${interpolatedRadius}%`;
      modelViewer.cameraTarget = `${interpolatedTargetX}m ${interpolatedTargetY}m ${interpolatedTargetZ}m`;
      modelViewer.fieldOfView = `${interpolatedFov}deg`;
    } else if (prevKeyframe && !nextKeyframe) {
      // We're past the last keyframe, hold position
      modelViewer.cameraOrbit = `${prevKeyframe.theta}deg ${prevKeyframe.phi}deg ${prevKeyframe.radius}%`;
      modelViewer.cameraTarget = `${prevKeyframe.targetX}m ${prevKeyframe.targetY}m ${prevKeyframe.targetZ}m`;
      modelViewer.fieldOfView = `${prevKeyframe.fov}deg`;
    } else if (!prevKeyframe && nextKeyframe && currentFrame < nextKeyframe.frame) {
      // We're before the first keyframe, apply first keyframe values
      modelViewer.cameraOrbit = `${nextKeyframe.theta}deg ${nextKeyframe.phi}deg ${nextKeyframe.radius}%`;
      modelViewer.cameraTarget = `${nextKeyframe.targetX}m ${nextKeyframe.targetY}m ${nextKeyframe.targetZ}m`;
      modelViewer.fieldOfView = `${nextKeyframe.fov}deg`;
    }
  }, [modelViewer, currentFrame, keyframes, cameraPlaybackEnabled, isAdjustingSliders]);

  // Keyboard shortcuts for "R" (record), "C" (copy), and "Delete" (delete selected keyframe)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isExpanded) return;
      
      // Check if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (duration > 0) {
          handleRecordKeyframe();
        }
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        // If a keyframe is selected, duplicate it; otherwise copy camera values
        if (selectedKeyframeIndex !== null) {
          handleDuplicateKeyframe(selectedKeyframeIndex);
        } else {
          handleCopy();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete only the selected keyframe (not the last one if none selected)
        if (selectedKeyframeIndex !== null) {
          e.preventDefault();
          handleDeleteKeyframe(selectedKeyframeIndex);
          setSelectedKeyframeIndex(null);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isExpanded, duration, handleRecordKeyframe, handleCopy, handleDuplicateKeyframe, keyframes, handleDeleteKeyframe, selectedKeyframeIndex, currentFrame, fps, onKeyframesChange]);

  return (
    <div className={`${className}`}>
      {!isExpanded ? (
        <Button
          onClick={() => setIsExpanded(true)}
          className="bg-black/50 hover:bg-black/70 text-white border border-blue-500/50 backdrop-blur-sm transition-all"
          size={isPortrait ? 'sm' : 'default'}
        >
          <Camera className={`${isPortrait ? 'h-4 w-4' : 'h-5 w-5'}`} />
          <span className="ml-2">Camera</span>
        </Button>
      ) : (
        <div className="bg-black/80 backdrop-blur-sm rounded-lg border border-blue-500/50 p-4 w-80 shadow-lg max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Camera Controls
            </h3>
            <Button
              onClick={() => setIsExpanded(false)}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>
          
           {/* Feedback Message */}
           {feedbackMessage && (
             <div className="bg-green-500/20 border border-green-500/50 rounded p-2 mb-3 flex items-center gap-2 animate-pulse">
               <Check className="h-4 w-4 text-green-400" />
               <span className="text-green-400 text-xs">{feedbackMessage}</span>
             </div>
           )}
           
           {/* Quick Match Presets */}
           <div className="bg-purple-500/10 border border-purple-500/30 rounded p-2 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-400 text-[10px] font-medium">⚡ QUICK MATCH</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  // Main app default values
                  setTheta(5);
                  setPhi(80);
                  setRadius(100); // 20m = 100%
                  setTargetX(0);
                  setTargetY(0);
                  setTargetZ(0);
                  setFov(45);
                  showFeedback('📐 Applied Main App Default');
                }}
                variant="ghost"
                size="sm"
                className="text-purple-400 hover:bg-purple-500/20 h-7 text-[10px] border border-purple-500/30"
              >
                Main App
              </Button>
              <Button
                onClick={() => {
                  // Wide view
                  setTheta(5);
                  setPhi(80);
                  setRadius(150);
                  setFov(60);
                  showFeedback('📷 Applied Wide View');
                }}
                variant="ghost"
                size="sm"
                className="text-purple-400 hover:bg-purple-500/20 h-7 text-[10px] border border-purple-500/30"
              >
                Wide View
              </Button>
            </div>
          </div>

           {/* Current Values Display */}
           <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-blue-400 text-[10px] font-medium">CURRENT VALUES</span>
              <Button
                onClick={handleReadCurrent}
                variant="ghost"
                size="sm"
                className="text-blue-400 hover:bg-blue-500/20 h-5 px-2 text-[10px]"
                title="Sync sliders with current values"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Sync
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <div className="text-white/60">Orbit: <span className="text-white">{currentTheta}° {currentPhi}° {currentRadius}%</span></div>
              <div className="text-white/60">FOV: <span className="text-white">{currentFov}°</span></div>
              <div className="text-white/60 col-span-2">Target: <span className="text-white">{currentTargetX}m {currentTargetY}m {currentTargetZ}m</span></div>
            </div>
          </div>

          {/* 🔍 ZOOM CONTROL CENTER - All factors affecting zoom */}
          <div className="bg-gradient-to-br from-orange-500/10 to-purple-500/10 border-2 border-orange-500/40 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-orange-400 text-sm font-bold">🔍 ZOOM CONTROL CENTER</span>
            </div>
            
            {/* 1. Radius (Camera Distance) */}
            <div className="mb-3 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-1">
                <label className="text-orange-300 text-xs font-medium">📏 Radius (Distance)</label>
                <span className="text-orange-400 text-xs font-bold">{radius}%</span>
              </div>
              <input
                type="range"
                min={radiusMin}
                max={radiusMax}
                step="1"
                value={radius}
                onMouseDown={() => setIsAdjustingSliders(true)}
                onMouseUp={() => setIsAdjustingSliders(false)}
                onTouchStart={() => setIsAdjustingSliders(true)}
                onTouchEnd={() => setIsAdjustingSliders(false)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= radiusMin && val <= radiusMax) {
                    setRadius(val);
                  }
                }}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-[9px] text-white/40 mt-1">
                <span>Min: {radiusMin}%</span>
                <span className="text-orange-400">{radius}%</span>
                <span>Max: {radiusMax}%</span>
              </div>
              
              {/* Radius Range Controls */}
              <div className="mt-2 pt-2 border-t border-orange-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-orange-300/70 text-[10px] w-12">Min:</label>
                  <input
                    type="range"
                    min="10"
                    max={radiusMax - 10}
                    step="5"
                    value={radiusMin}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRadiusMin(val);
                      if (radius < val) setRadius(val);
                    }}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-400"
                  />
                  <input
                    type="number"
                    min="10"
                    max={radiusMax - 10}
                    value={radiusMin}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 10 && val < radiusMax) {
                        setRadiusMin(val);
                        if (radius < val) setRadius(val);
                      }
                    }}
                    className="w-14 h-6 bg-gray-800 text-orange-300 text-[10px] rounded px-1 border border-orange-500/30"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-orange-300/70 text-[10px] w-12">Max:</label>
                  <input
                    type="range"
                    min={radiusMin + 10}
                    max="1000"
                    step="10"
                    value={radiusMax}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRadiusMax(val);
                      if (radius > val) setRadius(val);
                    }}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-400"
                  />
                  <input
                    type="number"
                    min={radiusMin + 10}
                    max="1000"
                    value={radiusMax}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val > radiusMin && val <= 1000) {
                        setRadiusMax(val);
                        if (radius > val) setRadius(val);
                      }
                    }}
                    className="w-14 h-6 bg-gray-800 text-orange-300 text-[10px] rounded px-1 border border-orange-500/30"
                  />
                </div>
              </div>
            </div>

            {/* 2. FOV (Field of View) */}
            <div className="mb-3 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-1">
                <label className="text-purple-300 text-xs font-medium">📐 FOV (Lens Angle)</label>
                <span className="text-purple-400 text-xs font-bold">{fov}°</span>
              </div>
              <input
                type="range"
                min={fovMin}
                max={fovMax}
                step="1"
                value={fov}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= fovMin && val <= fovMax) {
                    setFov(val);
                  }
                }}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-[9px] text-white/40 mt-1">
                <span>Min: {fovMin}°</span>
                <span className="text-purple-400">{fov}°</span>
                <span>Max: {fovMax}°</span>
              </div>
              
              {/* FOV Range Controls */}
              <div className="mt-2 pt-2 border-t border-purple-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-purple-300/70 text-[10px] w-12">Min:</label>
                  <input
                    type="range"
                    min="1"
                    max={fovMax - 1}
                    step="1"
                    value={fovMin}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFovMin(val);
                      if (fov < val) setFov(val);
                    }}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                  />
                  <input
                    type="number"
                    min="1"
                    max={fovMax - 1}
                    value={fovMin}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 1 && val < fovMax) {
                        setFovMin(val);
                        if (fov < val) setFov(val);
                      }
                    }}
                    className="w-12 h-6 bg-gray-800 text-purple-300 text-[10px] rounded px-1 border border-purple-500/30"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-purple-300/70 text-[10px] w-12">Max:</label>
                  <input
                    type="range"
                    min={fovMin + 1}
                    max="180"
                    step="1"
                    value={fovMax}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFovMax(val);
                      if (fov > val) setFov(val);
                    }}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                  />
                  <input
                    type="number"
                    min={fovMin + 1}
                    max="180"
                    value={fovMax}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val > fovMin && val <= 180) {
                        setFovMax(val);
                        if (fov > val) setFov(val);
                      }
                    }}
                    className="w-12 h-6 bg-gray-800 text-purple-300 text-[10px] rounded px-1 border border-purple-500/30"
                  />
                </div>
              </div>
            </div>

            {/* 3. Target Y (Vertical Look Position) */}
            <div className="mb-3 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-1">
                <label className="text-blue-300 text-xs font-medium">🎯 Target Y (Look Height)</label>
                <span className="text-blue-400 text-xs font-bold">{targetY.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={targetY}
                onChange={(e) => setTargetY(Number(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[9px] text-white/40 mt-1">
                <span>Look Down</span>
                <span className="text-blue-400">0m</span>
                <span>Look Up</span>
              </div>
            </div>

            {/* 4. Phi (Vertical Angle) */}
            <div className="mb-3 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-1">
                <label className="text-green-300 text-xs font-medium">⬆️ Phi (Vertical Angle)</label>
                <span className="text-green-400 text-xs font-bold">{phi}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                step="1"
                value={phi}
                onChange={(e) => setPhi(Number(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <div className="flex justify-between text-[9px] text-white/40 mt-1">
                <span>Top View (0°)</span>
                <span className="text-green-400">80°</span>
                <span>Bottom (180°)</span>
              </div>
            </div>

            {/* 5. Theta (Horizontal Rotation) */}
            <div className="mb-3 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-1">
                <label className="text-yellow-300 text-xs font-medium">↔️ Theta (Rotation)</label>
                <span className="text-yellow-400 text-xs font-bold">{theta}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={theta}
                onChange={(e) => setTheta(Number(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
              <div className="flex justify-between text-[9px] text-white/40 mt-1">
                <span>0°</span>
                <span className="text-yellow-400">180°</span>
                <span>360°</span>
              </div>
            </div>

            {/* 6. Orbit Distance Limits */}
            <div className="mb-3 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <label className="text-red-300 text-xs font-medium">🔒 Orbit Distance Limits</label>
                <button
                  onClick={() => setOrbitLimitsEnabled(!orbitLimitsEnabled)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                    orbitLimitsEnabled
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                      : 'bg-gray-700 text-gray-400 border border-gray-600'
                  }`}
                >
                  {orbitLimitsEnabled ? '🔒 ON' : '🔓 OFF'}
                </button>
              </div>
              
              {orbitLimitsEnabled && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <label className="text-red-300/70 text-[10px] w-12">Min:</label>
                    <input
                      type="range"
                      min="0.1"
                      max={maxOrbitRadius - 0.5}
                      step="0.5"
                      value={minOrbitRadius}
                      onChange={(e) => setMinOrbitRadius(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-400"
                    />
                    <input
                      type="number"
                      min="0.1"
                      max={maxOrbitRadius - 0.5}
                      step="0.5"
                      value={minOrbitRadius}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0.1 && val < maxOrbitRadius) {
                          setMinOrbitRadius(val);
                        }
                      }}
                      className="w-14 h-6 bg-gray-800 text-red-300 text-[10px] rounded px-1 border border-red-500/30"
                    />
                    <span className="text-red-300/70 text-[10px]">m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-red-300/70 text-[10px] w-12">Max:</label>
                    <input
                      type="range"
                      min={minOrbitRadius + 0.5}
                      max="200"
                      step="1"
                      value={maxOrbitRadius}
                      onChange={(e) => setMaxOrbitRadius(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-400"
                    />
                    <input
                      type="number"
                      min={minOrbitRadius + 0.5}
                      max="200"
                      step="1"
                      value={maxOrbitRadius}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val > minOrbitRadius && val <= 200) {
                          setMaxOrbitRadius(val);
                        }
                      }}
                      className="w-14 h-6 bg-gray-800 text-red-300 text-[10px] rounded px-1 border border-red-500/30"
                    />
                    <span className="text-red-300/70 text-[10px]">m</span>
                  </div>
                  <div className="text-[9px] text-red-300/60 mt-1">
                    💡 Limits camera distance in meters (not percentage)
                  </div>
                </div>
              )}
            </div>

            {/* 7. Camera Smoothness */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-cyan-300 text-xs font-medium">🎬 Camera Smoothness</label>
                <span className="text-cyan-400 text-xs font-bold">{interpolationDecay}ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={interpolationDecay}
                onChange={(e) => setInterpolationDecay(Number(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[9px] text-white/40 mt-1">
                <span>Instant (0ms)</span>
                <span className="text-cyan-400">Default: 100ms</span>
                <span>Smooth (500ms)</span>
              </div>
              <div className="text-[9px] text-cyan-300/60 mt-1">
                💡 Controls how smoothly camera transitions between positions
              </div>
            </div>

            {/* Quick Reset */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <Button
                onClick={() => {
                  setRadius(100);
                  setRadiusMin(10);
                  setRadiusMax(500);
                  setFov(45);
                  setFovMin(1);
                  setFovMax(180);
                  setTargetY(0);
                  setPhi(80);
                  setTheta(5);
                  setInterpolationDecay(100);
                  showFeedback('🔄 Reset to defaults');
                }}
                variant="ghost"
                size="sm"
                className="w-full text-white/70 hover:bg-white/10 h-7 text-[10px] border border-white/20"
              >
                🔄 Reset All Zoom Controls
              </Button>
            </div>
          </div>

          {/* Camera Orbit Controls */}
          <div className="space-y-3 mb-4">
            <h4 className="text-white/70 text-xs font-medium">Camera Orbit</h4>
            
            {/* Theta */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-white/70 text-xs">Theta (Horizontal)</label>
                <span className="text-white text-xs">{theta}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={theta}
                onChange={(e) => setTheta(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Phi */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-white/70 text-xs">Phi (Vertical)</label>
                <span className="text-white text-xs">{phi}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                value={phi}
                onChange={(e) => setPhi(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Radius */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-white/70 text-xs">Radius (Zoom)</label>
                <span className="text-white text-xs">{radius}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          {/* FOV Control */}
          <div className="space-y-3 mb-4 pt-4 border-t border-white/10">
            <h4 className="text-white/70 text-xs font-medium">Field of View</h4>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-white/70 text-xs">FOV (Zoom Lens)</label>
                <span className="text-white text-xs">{fov}°</span>
              </div>
              <input
                type="range"
                min="1"
                max="180"
                value={fov}
                onChange={(e) => setFov(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
          
          {/* Camera Target Controls */}
          <div className="space-y-3 mb-4 pt-4 border-t border-white/10">
            <h4 className="text-white/70 text-xs font-medium">Camera Target</h4>
            
            {/* Target X */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-white/70 text-xs">Target X</label>
                <span className="text-white text-xs">{targetX.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={targetX}
                onChange={(e) => setTargetX(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Target Y */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-white/70 text-xs">Target Y</label>
                <span className="text-white text-xs">{targetY.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={targetY}
                onChange={(e) => setTargetY(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Target Z */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-white/70 text-xs">Target Z</label>
                <span className="text-white text-xs">{targetZ.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={targetZ}
                onChange={(e) => setTargetZ(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

           {/* Keyframe Recording Section */}
           <div className="space-y-2 pt-4 border-t border-white/10">
             <div className="flex items-center justify-between">
               <h4 className="text-white/70 text-xs font-medium">Camera Keyframes</h4>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] text-white/50">Playback:</span>
                 <button
                   onClick={() => {
                     setCameraPlaybackEnabled(!cameraPlaybackEnabled);
                     showFeedback(cameraPlaybackEnabled ? '⏸️ Camera playback disabled' : '▶️ Camera playback enabled');
                   }}
                   className={`text-xs px-2 py-1 rounded ${
                     cameraPlaybackEnabled
                       ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                       : 'bg-white/10 text-white/50 border border-white/20'
                   }`}
                 >
                   {cameraPlaybackEnabled ? '▶️ ON' : '⏸️ OFF'}
                 </button>
               </div>
             </div>
             
             <div className="flex gap-2 items-center">
               <input
                 type="text"
                 value={keyframeName}
                 onChange={(e) => setKeyframeName(e.target.value)}
                 placeholder="Keyframe name"
                 className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-blue-500"
               />
               <Button
                 onClick={handleRecordKeyframe}
                 variant="outline"
                 size="sm"
                 className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 border-blue-500/50"
                 disabled={duration === 0}
                 title={duration === 0 ? "Load a model with animation first" : "Record keyframe at current time (R)"}
               >
                 <Plus className="h-4 w-4 mr-1" />
                 Record (R)
               </Button>
             </div>
             
             <div className="text-[10px] text-white/50">
               Frame: {currentFrame} | Time: {duration > 0 ? (currentFrame / fps).toFixed(2) : 0}s
             </div>
             
             {/* Keyframe List */}
             {keyframes.length > 0 && (
               <div className="space-y-1 max-h-32 overflow-y-auto">
               {keyframes.map((kf, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedKeyframeIndex(index)}
                    className={`border rounded p-2 flex items-center justify-between group transition-colors cursor-pointer ${
                      selectedKeyframeIndex === index
                        ? 'bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex-1">
                      <div className={`text-xs ${selectedKeyframeIndex === index ? 'text-blue-300' : 'text-white'}`}>
                        {kf.name}
                      </div>
                      <div className="text-white/50 text-[10px]">
                        F:{kf.frame} | θ:{kf.theta}° φ:{kf.phi}° r:{kf.radius}%
                      </div>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKeyframe(index);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:bg-red-500/20 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete keyframe (Del)"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
               </div>
             )}
             
             {/* Import/Export Buttons */}
             <div className="space-y-2">
               <div className="flex gap-2">
                 <div className="flex-1">
                   <input
                     type="file"
                     accept=".json"
                     onChange={handleImportJSON}
                     id="camera-json-import"
                     className="hidden"
                   />
                   <Button
                     onClick={() => document.getElementById('camera-json-import')?.click()}
                     variant="outline"
                     size="sm"
                     className="w-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 border-blue-500/50"
                     title="Import camera animation JSON with keyframes and settings"
                   >
                     <Upload className="h-4 w-4 mr-1" />
                     Camera JSON
                   </Button>
                 </div>
                 
                 <div className="flex-1">
                   <Button
                     onClick={handleExportJSON}
                     variant="outline"
                     size="sm"
                     className="w-full bg-green-500/20 hover:bg-green-500/40 text-green-400 border-green-500/50"
                     disabled={keyframes.length === 0}
                     title={keyframes.length === 0 ? "Add keyframes to export" : "Export camera animation JSON"}
                   >
                     <Download className="h-4 w-4 mr-1" />
                     Export {keyframes.length > 0 && `(${keyframes.length})`}
                   </Button>
                 </div>
               </div>
               
               {onLabelJsonImport && (
                 <div className="flex gap-2">
                   <div className="flex-1">
                     <input
                       type="file"
                       accept=".json"
                       onChange={handleLabelImport}
                       id="label-json-import"
                       className="hidden"
                     />
                     <Button
                       onClick={() => document.getElementById('label-json-import')?.click()}
                       variant="outline"
                       size="sm"
                       className="w-full bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 border-purple-500/50"
                       title="Import label JSON for AR labels/hotspots"
                     >
                       <Upload className="h-4 w-4 mr-1" />
                       🏷️ Label JSON
                     </Button>
                   </div>
                 </div>
               )}
             </div>
             
             <div className="text-[10px] text-white/50 text-center space-y-1">
               <div>💡 Press R to record | C to copy | Del to delete</div>
               {keyframes.length > 0 && (
                 <div className={cameraPlaybackEnabled ? 'text-green-400' : 'text-white/50'}>
                   {cameraPlaybackEnabled ? '▶️ Camera animation playing' : '⏸️ Camera animation paused'}
                 </div>
               )}
               {selectedKeyframeIndex !== null && keyframes[selectedKeyframeIndex] && (
                 <div className="text-yellow-400">
                   ⭐ Selected: {keyframes[selectedKeyframeIndex].name} - Press Del to delete
                 </div>
               )}
             </div>
           </div>
           
           {/* Action Buttons */}
           <div className="flex gap-2 pt-4 border-t border-white/10 mt-2">
             <Button
               onClick={handleReset}
               variant="outline"
               size="sm"
               className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20"
             >
               <RotateCw className="h-4 w-4 mr-1" />
               Reset
             </Button>
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20"
              title="Copy camera values (C)"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy (C)
            </Button>
           </div>

           <p className="text-white/50 text-[10px] mt-3 text-center">
             Record keyframes synced with timeline
           </p>
        </div>
      )}
    </div>
  );
};

export default CameraOrbitControls;
export type { CameraKeyframe };

