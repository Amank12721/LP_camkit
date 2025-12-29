'use client';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from './ui/button';
import { CameraKeyframe } from './CameraOrbitControls';

interface CameraTimelineProps {
  currentFrame: number;
  duration: number;
  fps: number;
  keyframes: CameraKeyframe[];
  isPlaying?: boolean;
  cameraPlaybackEnabled?: boolean;
  onSeek?: (frame: number) => void;
  onKeyframeClick?: (keyframe: CameraKeyframe, index: number) => void;
  onToggleCameraPlayback?: () => void;
  onTogglePlay?: () => void;
  onKeyframeUpdate?: (index: number, newFrame: number) => void;
  selectedKeyframeIndex?: number | null;
  className?: string;
}

const CameraTimeline: React.FC<CameraTimelineProps> = ({
  currentFrame,
  duration,
  fps,
  keyframes,
  isPlaying = false,
  cameraPlaybackEnabled = true,
  onSeek,
  onKeyframeClick,
  onToggleCameraPlayback,
  onTogglePlay,
  selectedKeyframeIndex = null,
  className = '',
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const frameInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredKeyframe, setHoveredKeyframe] = useState<CameraKeyframe | null>(null);
  const [draggingKeyframe, setDraggingKeyframe] = useState<{ index: number; keyframe: CameraKeyframe } | null>(null);
  const [showFrameJump, setShowFrameJump] = useState(false);
  const [frameJumpValue, setFrameJumpValue] = useState('');

  const totalFrames = Math.ceil(duration * fps);
  const currentPercent = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    const frame = Math.round((percent / 100) * totalFrames);
    const clampedFrame = Math.max(0, Math.min(frame, totalFrames));

    if (onSeek) {
      onSeek(clampedFrame);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't start timeline dragging if we're dragging a keyframe
    if (draggingKeyframe) return;
    
    e.preventDefault();
    setIsDragging(true);
    handleTimelineClick(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      e.preventDefault();
      handleTimelineClick(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Handle dragging and mouse up outside timeline
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
        const frame = Math.round((percent / 100) * totalFrames);
        const clampedFrame = Math.max(0, Math.min(frame, totalFrames));
        
        if (onSeek) {
          onSeek(clampedFrame);
        }
      };
      
      const handleGlobalMouseUp = () => setIsDragging(false);
      
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, totalFrames, onSeek]);

  // Arrow key support for scrubbing with smooth continuous movement
  useEffect(() => {
    let animationFrameId: number | null = null;
    let pressedKey: 'left' | 'right' | null = null;
    let isShiftPressed = false;
    let lastUpdateTime = 0;
    const updateInterval = 16; // ~60fps
    
    const updateFrame = (timestamp: number) => {
      if (!pressedKey || !onSeek) {
        animationFrameId = null;
        return;
      }
      
      if (timestamp - lastUpdateTime >= updateInterval) {
        const step = isShiftPressed ? 10 : 1; // Move 10 frames with Shift, 1 without
        
        if (pressedKey === 'left') {
          const newFrame = Math.max(0, currentFrame - step);
          onSeek(newFrame);
        } else if (pressedKey === 'right') {
          const newFrame = Math.min(totalFrames, currentFrame + step);
          onSeek(newFrame);
        }
        lastUpdateTime = timestamp;
      }
      
      animationFrameId = requestAnimationFrame(updateFrame);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Track Shift key state
      if (e.shiftKey) {
        isShiftPressed = true;
      }
      
      // F key to open frame jump input
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setShowFrameJump(true);
        setFrameJumpValue(currentFrame.toString());
        // Focus the input after state update
        setTimeout(() => frameInputRef.current?.focus(), 0);
        return;
      }
      
      // Prevent default arrow key behavior (model rotation)
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      // Up/Down arrows to cycle through keyframe selection
      if (e.key === 'ArrowUp') {
        if (keyframes.length === 0) return;
        
        let targetIndex: number;
        if (selectedKeyframeIndex === null) {
          // No selection, select first keyframe
          targetIndex = 0;
        } else if (selectedKeyframeIndex <= 0) {
          // At first, wrap to last keyframe
          targetIndex = keyframes.length - 1;
        } else {
          // Select previous keyframe
          targetIndex = selectedKeyframeIndex - 1;
        }
        
        onKeyframeClick?.(keyframes[targetIndex], targetIndex);
        // Jump timeline to the keyframe's frame
        if (onSeek) {
          onSeek(keyframes[targetIndex].frame);
        }
      } else if (e.key === 'ArrowDown') {
        if (keyframes.length === 0) return;
        
        let targetIndex: number;
        if (selectedKeyframeIndex === null) {
          // No selection, select first keyframe
          targetIndex = 0;
        } else if (selectedKeyframeIndex >= keyframes.length - 1) {
          // At last, wrap to first keyframe
          targetIndex = 0;
        } else {
          // Select next keyframe
          targetIndex = selectedKeyframeIndex + 1;
        }
        
        onKeyframeClick?.(keyframes[targetIndex], targetIndex);
        // Jump timeline to the keyframe's frame
        if (onSeek) {
          onSeek(keyframes[targetIndex].frame);
        }
      } else if (e.key === 'ArrowLeft' && pressedKey !== 'left') {
        pressedKey = 'left';
        const step = e.shiftKey ? 10 : 1;
        // Immediate first move
        const newFrame = Math.max(0, currentFrame - step);
        if (onSeek) onSeek(newFrame);
        // Start continuous movement
        if (!animationFrameId) {
          lastUpdateTime = performance.now();
          animationFrameId = requestAnimationFrame(updateFrame);
        }
      } else if (e.key === 'ArrowRight' && pressedKey !== 'right') {
        pressedKey = 'right';
        const step = e.shiftKey ? 10 : 1;
        // Immediate first move
        const newFrame = Math.min(totalFrames, currentFrame + step);
        if (onSeek) onSeek(newFrame);
        // Start continuous movement
        if (!animationFrameId) {
          lastUpdateTime = performance.now();
          animationFrameId = requestAnimationFrame(updateFrame);
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && pressedKey === 'left') {
        pressedKey = null;
      } else if (e.key === 'ArrowRight' && pressedKey === 'right') {
        pressedKey = null;
      } else if (e.key === 'Shift') {
        isShiftPressed = false;
      }
    };
    
    // Reset keys when window loses focus
    const handleBlur = () => {
      pressedKey = null;
      isShiftPressed = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [currentFrame, totalFrames, onSeek]);

  // Keyframe dragging handlers
  const handleKeyframeMouseDown = (e: React.MouseEvent, keyframe: CameraKeyframe, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(false); // Stop timeline dragging
    setDraggingKeyframe({ index, keyframe });
  };


  const handleKeyframeMouseUp = useCallback(() => {
    if (draggingKeyframe) {
      // Notify parent of the keyframe update
      if ((window as any).updateKeyframePosition) {
        (window as any).updateKeyframePosition(draggingKeyframe.index, draggingKeyframe.keyframe.frame);
      }
      setDraggingKeyframe(null);
    }
  }, [draggingKeyframe]);

  useEffect(() => {
    if (draggingKeyframe) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const moveX = e.clientX - rect.left;
        const newTime = Math.max(0, Math.min(duration, (moveX / rect.width) * duration));
        const newFrame = Math.round(newTime * fps);
        
        const updatedKeyframe = {
          ...draggingKeyframe.keyframe,
          frame: newFrame,
          time: parseFloat((newFrame / fps).toFixed(2)),
        };
        setDraggingKeyframe({ ...draggingKeyframe, keyframe: updatedKeyframe });
      };
      
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleKeyframeMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleKeyframeMouseUp);
      };
    }
  }, [draggingKeyframe, duration, fps, handleKeyframeMouseUp]);

  // Generate time markers
  const timeMarkers = [];
  const markerInterval = Math.ceil(totalFrames / 10); // ~10 markers
  for (let i = 0; i <= totalFrames; i += markerInterval) {
    const percent = (i / totalFrames) * 100;
    const timeInSeconds = i / fps;
    timeMarkers.push({ frame: i, percent, time: timeInSeconds });
  }

  return (
    <div className={`${className}`}>
      <div className="bg-black/80 backdrop-blur-sm rounded-lg border border-blue-500/50 p-4 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            {onTogglePlay && (
              <Button
                onClick={onTogglePlay}
                variant="outline"
                size="sm"
                className={`h-8 w-8 p-0 ${
                  isPlaying
                    ? 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30'
                }`}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            )}
            
            <div className="text-white text-sm font-semibold">
              Camera Timeline
            </div>
            
            {onToggleCameraPlayback && (
              <button
                onClick={onToggleCameraPlayback}
                className={`text-xs px-3 py-1 rounded-full transition-all ${
                  cameraPlaybackEnabled
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
                    : 'bg-white/10 text-white/50 border border-white/20 hover:bg-white/20'
                }`}
              >
                {cameraPlaybackEnabled ? '▶️ Camera ON' : '⏸️ Camera OFF'}
              </button>
            )}
          </div>
          <div className="text-white/70 text-xs flex items-center gap-2">
            {showFrameJump ? (
              <div className="flex items-center gap-1">
                <span>Jump to frame:</span>
                <input
                  ref={frameInputRef}
                  type="number"
                  min="0"
                  max={totalFrames}
                  value={frameJumpValue}
                  onChange={(e) => setFrameJumpValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const frame = parseInt(frameJumpValue);
                      if (!isNaN(frame) && frame >= 0 && frame <= totalFrames) {
                        onSeek?.(frame);
                      }
                      setShowFrameJump(false);
                    } else if (e.key === 'Escape') {
                      setShowFrameJump(false);
                    }
                  }}
                  onBlur={() => setShowFrameJump(false)}
                  className="w-16 px-1 py-0.5 bg-gray-800 border border-blue-500 rounded text-blue-400 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-white/50 text-[10px]">(Press F)</span>
              </div>
            ) : (
              <>
                Frame: <span className="text-blue-400 font-mono">{currentFrame}</span> / {totalFrames}
                <span className="text-white/50 text-[10px]">(Press F to jump)</span>
              </>
            )}
          </div>
        </div>

        {/* Timeline Container */}
        <div
          ref={timelineRef}
          className="relative h-16 bg-gray-900/50 rounded-lg border border-white/10 cursor-pointer select-none overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Time Markers */}
          {timeMarkers.map((marker, index) => (
            <div
              key={index}
              className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
              style={{ left: `${marker.percent}%` }}
            >
              <div className="w-px h-2 bg-white/30" />
              <span className="text-[8px] text-white/50 mt-1 font-mono">
                {marker.frame}
              </span>
            </div>
          ))}

          {/* Connecting Lines Between Same-Value Keyframes */}
          {keyframes.map((keyframe, index) => {
            if (index === keyframes.length - 1) return null; // Skip last keyframe
            
            const nextKeyframe = keyframes[index + 1];
            const areSame = 
              keyframe.theta === nextKeyframe.theta &&
              keyframe.phi === nextKeyframe.phi &&
              keyframe.radius === nextKeyframe.radius &&
              keyframe.targetX === nextKeyframe.targetX &&
              keyframe.targetY === nextKeyframe.targetY &&
              keyframe.targetZ === nextKeyframe.targetZ &&
              keyframe.fov === nextKeyframe.fov;
            
            if (!areSame) return null;
            
            const startPercent = totalFrames > 0 ? (keyframe.frame / totalFrames) * 100 : 0;
            const endPercent = totalFrames > 0 ? (nextKeyframe.frame / totalFrames) * 100 : 0;
            const width = endPercent - startPercent;
            
            return (
              <div
                key={`line-${index}`}
                className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-green-500/60 z-0"
                style={{ 
                  left: `${startPercent}%`, 
                  width: `${width}%` 
                }}
                title="Same camera values"
              />
            );
          })}

          {/* Keyframe Dots */}
          {keyframes.map((keyframe, index) => {
            const isDraggingThis = draggingKeyframe?.index === index;
            const isSelected = selectedKeyframeIndex === index;
            const displayKeyframe = isDraggingThis ? draggingKeyframe.keyframe : keyframe;
            const keyframePercent = totalFrames > 0 ? (displayKeyframe.frame / totalFrames) * 100 : 0;
            
            return (
              <div
                key={keyframe.id || `${keyframe.name}-${keyframe.frame}`}
                className={`absolute top-1/2 -translate-y-1/2 group ${isDraggingThis ? 'z-50' : 'z-10'}`}
                style={{ left: `${keyframePercent}%` }}
                onMouseEnter={() => !isDraggingThis && setHoveredKeyframe(keyframe)}
                onMouseLeave={() => !isDraggingThis && setHoveredKeyframe(null)}
                onMouseDown={(e) => handleKeyframeMouseDown(e, keyframe, index)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDraggingThis) {
                    onKeyframeClick?.(keyframe, index);
                  }
                }}
              >
                {/* Keyframe Dot */}
                <div className={`w-3 h-3 rounded-full border-2 shadow-lg transform transition-all ${
                  isDraggingThis ? 'cursor-grabbing scale-150' : 'cursor-grab group-hover:scale-125'
                } ${
                  isSelected 
                    ? 'bg-yellow-400 border-yellow-300 ring-2 ring-yellow-400/50 scale-125' 
                    : 'bg-blue-500 border-white'
                }`}>
                  {/* Vertical Line */}
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-px h-16 -translate-y-full ${
                    isSelected ? 'bg-yellow-400/50' : 'bg-blue-500/30'
                  }`} />
                </div>

                {/* Tooltip */}
                {(hoveredKeyframe === keyframe || isDraggingThis) && (
                  <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/90 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20 border ${
                    isSelected ? 'border-yellow-400/50' : 'border-blue-500/50'
                  }`}>
                    <div className={`font-semibold ${isSelected ? 'text-yellow-300' : ''}`}>
                      {displayKeyframe.name} {isSelected ? '(Selected)' : ''}
                    </div>
                    <div className="text-white/70">
                      F:{displayKeyframe.frame} | θ:{displayKeyframe.theta}° φ:{displayKeyframe.phi}° r:{displayKeyframe.radius}%
                    </div>
                    <div className="text-white/70">
                      FOV:{displayKeyframe.fov}° | Target:({displayKeyframe.targetX},{displayKeyframe.targetY},{displayKeyframe.targetZ})
                    </div>
                    {isDraggingThis && (
                      <div className="text-yellow-400 text-[9px] mt-1">🔄 Dragging...</div>
                    )}
                    {isSelected && !isDraggingThis && (
                      <div className="text-yellow-400 text-[9px] mt-1">Press Delete to remove</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
            style={{ left: `${currentPercent}%` }}
          >
            {/* Playhead Handle - Extended upward */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-grab active:cursor-grabbing">
              {/* Vertical extension line */}
              <div className="w-0.5 h-8 bg-red-500" />
              {/* Handle circle */}
              <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg" />
            </div>
          </div>

          {/* Progress Fill */}
          <div
            className="absolute top-0 left-0 bottom-0 bg-blue-500/20 pointer-events-none"
            style={{ width: `${currentPercent}%` }}
          />
        </div>

        {/* Info */}
        <div className="mt-2 flex items-center justify-between text-[10px]">
          <span className="text-white/50">
            {keyframes.length} keyframe{keyframes.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-white/50">
              Click timeline to seek | Blue dots = keyframes
            </span>
            {keyframes.length > 0 && (
              <span className={cameraPlaybackEnabled ? 'text-green-400' : 'text-white/50'}>
                {isPlaying ? (cameraPlaybackEnabled ? '▶️ Animating camera' : '⏸️ Camera paused') : '⏸️ Paused'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraTimeline;

