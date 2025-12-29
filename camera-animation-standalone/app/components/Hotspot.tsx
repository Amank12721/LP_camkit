import React from "react";

interface Position {
  x: number;
  y: number;
  z: number;
}

interface HotspotProps {
  index: number;
  position: Position;
  onClick: () => void;
  isActive: boolean;
  appearFrame?: number;
  disappearFrame?: number;
  currentFrame?: number;
}

const Hotspot: React.FC<HotspotProps> = ({
  index,
  position,
  onClick,
  isActive,
  appearFrame,
  disappearFrame,
  currentFrame = 0,
}) => {
  const positionString = `${position.x.toFixed(6)} ${position.y.toFixed(6)} ${position.z.toFixed(6)}`;

  const isVisibleForCurrentFrame =
    (appearFrame === undefined || currentFrame >= appearFrame) &&
    (disappearFrame === undefined || currentFrame < disappearFrame);

  return (
    <button
      slot={`hotspot-dot-${index}`}
      onClick={onClick}
      aria-label={`Hotspot ${index}`}
      aria-expanded={isActive}
      data-position={positionString}
      data-visible={isVisibleForCurrentFrame ? "true" : "false"}
      data-visibility-attribute="visible"
      className={`w-4 h-4 rounded-full border-2 border-white cursor-pointer transition-all duration-200
        ${isVisibleForCurrentFrame ? "block opacity-100" : "hidden opacity-0"}
        ${isActive ? "bg-blue-600 scale-125" : "bg-blue-500/90 hover:scale-125 hover:bg-blue-600"}`}
    />
  );
};

export default Hotspot;
