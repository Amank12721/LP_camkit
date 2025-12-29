/**
 * Global type declarations for model-viewer
 */

import { float } from "three/src/nodes/TSL.js";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src: string;
        alt: string;
        "camera-controls"?: boolean;
        "animation-name"?: string;
        autoplay?: boolean;
        loading?: "auto" | "lazy" | "eager";
        reveal?: "auto" | "manual";
        style?: React.CSSProperties;
        className?: string;
        ar?: boolean;
        "ar-modes"?: string;
        "ar-scale"?: "auto" | "fixed";
        "ar-placement"?: "floor" | "wall";
        shadowIntensity?: string;
        shadowSoftness?: string;
        exposure?: string;
        "tone-mapping"?: string;
        ref?: React.RefObject<ModelViewerElement>;
        "field-of-view"?: string;
        "min-field-of-view"?: string;
        "max-field-of-view"?: string;
        "camera-orbit"?: string;
        "min-camera-orbit"?: string;
        "max-camera-orbit"?: string;
        "camera-target"?: string;
        "environment-intensity"?: string;
        "disable-occlusion"?: boolean;
        "emissive-intensity"?: string;
        "interaction-prompt"?: "auto" | "none";
        children?: React.ReactNode;
      };

      "effect-composer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        "render-mode"?: "quality" | "lightweight";
        ref?: React.Ref<HTMLElement & { selection: Set<object> }>; // Changed 'any' to 'object'
        children?: React.ReactNode;
      };

      "selective-bloom-effect": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        strength?: string;
        radius?: string;
        threshold?: string;
        ref?: React.Ref<HTMLElement & { selection: object[] }>; // Changed 'any' to 'object'
      };
    }
  }
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface ModelHierarchyNode {
  name: string;
  mesh?: {
    position?: Vector3;
  };
  position?: Vector3;
  children?: ModelHierarchyNode[];
}

export interface ModelWithHierarchy {
  [key: symbol]: ModelHierarchyNode[];
}

export interface ModelViewerElement extends HTMLElement {
  src: string;
  alt: string;
  cameraControls?: boolean;
  animationName?: string;
  autoplay?: boolean;
  currentTime?: number;
  duration?: number;
  availableAnimations?: string[];
  pause?: () => void;
  play?: () => void;
  updateComplete?: Promise<boolean>;
  model?: ModelWithHierarchy;
  fieldOfView: string | number;
  minFieldOfView: string | number;
  maxFieldOfView: string | number;
  cameraTarget?: string;
  cameraOrbit?: string;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  exposure?: number;
  environmentIntensity?: number;
  shadowIntensity?: number;
  shadowSoftness?: number;
  disableOcclusion?: boolean;
  emissiveIntensity?: number;
  toneMapping?: string;
  interactionPrompt?: "auto" | "none";
}

// Text item in the label data structure
export interface LabelTextItem {
  text: string;
  lang: string;
  audio_path?: string;
  audio_signed_url?: string;
}

// Animation frame data
export interface AnimationFrameData {
  first_value: number;
  second_value: number;
}

// Animation data structure
export interface AnimationData {
  frame: AnimationFrameData;
}

// Label data item structure
export interface LabelDataItem {
  id: number;
  text: LabelTextItem[];
  isAnimation?: boolean;
  animation?: {
    frame: AnimationFrameData;
  };
}

// The main label data structure - updated to match API response
export interface LabelDataStructure {
  id: number;
  isAnimation: boolean;
  text: LabelTextItem[];
  animation?: AnimationData;
}
export interface FrameAudioData {
  id: number;
  path: string;
  start_frame: number;
  end_frame: number;
  volume: number;
  signed_url: string;
}

export interface dynamicCameraFile {
  signed_url?: string;
}

// Frame Transition Data
export interface FrameTransitionData {
  id: number;
  type: "panorama" | "model";
  start_frame: number;
  end_frame: number;
  path?: string;
  title?: string;
  description?: string;
  signed_url?: string;
}

export interface HotspotData {
  id: string;
  position: Vector3;
  isActive: boolean;
  appearFrame?: number;
  disappearFrame?: number;
}

export interface  CustomModelViewerContainerProps {
  modelPath: string;
  enableDrawingFeatures?: boolean;
  modelComment?: string;
  modelTitle?: string;
  modelFileName?: string;
  labelData?: LabelDataStructure[];
  FrameAudioData?: FrameAudioData[];
  audioPath?: string;
  audioRef?: React.RefObject<HTMLAudioElement>;
  showLabelsOnly?: boolean;
  haveEmission?: boolean;
  exposure?: number;
  toneMapping?:string,                     
  toneMappingexposur?:number, 
  dynamicCameraFile?: dynamicCameraFile;
  onModelViewerRef?: (ref: ModelViewerElement | null) => void;
}

export interface HybridModelViewerProps
  extends CustomModelViewerContainerProps {
  frameTransitionData?: FrameTransitionData[];
  frameAudioData?: FrameAudioData[];
}

export interface AnimationControlsProps {
  modelViewer: ModelViewerElement | null;
  modelPath?: string;
  audioRef?: React.RefObject<HTMLAudioElement>;
  audioPath?: string;
  onTimeUpdate?: (time: number, forceUpdate?: boolean) => void;
  onDurationChange?: (duration: number) => void;
  modelFileName?: string;
  modelLoaded?: boolean;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export interface PanoramaViewerProps {
  panoramaPath: string;
  enableDrawingFeatures?: boolean;
  modelComment?: string;
  modelTitle?: string;
}
