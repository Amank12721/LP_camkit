import { Button } from "./ui/button";
import { useEffect, useRef } from "react";
import useOrientation from "../hooks/useOrientation";

interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Annotation {
  label: string;
  position: Position;
  appearFrame?: number;
  disappearFrame?: number;
  isVisible?: boolean;
  hotspotId?: string;
}

interface ModelAnnotationsProps {
  annotations: Annotation[];
  currentFrame: number;
  labelScale?: number; // Scale percentage (default 100)
}

// Format label text - let Tailwind handle whitespace formatting
const formatLabelText = (text: string): string => {
  return (
    text
      .replace(/\\n/g, "\n")
      .replace(/\n+/g, "\n")
      .trim()
  );
};

// cn utility function (same as main app)
const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(" ");
};

const ModelAnnotations: React.FC<ModelAnnotationsProps> = ({
  annotations,
  currentFrame,
  labelScale = 100,
}) => {
  const { isPortrait } = useOrientation();
  const annotationRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  
  // Calculate scaled sizes based on labelScale percentage
  const baseFontSize = isPortrait ? 12 : 18; // text-xs = 12px, text-lg = 18px
  const scaledFontSize = (baseFontSize * labelScale) / 100;
  const scaledPaddingX = (16 * labelScale) / 100; // px-4 = 16px
  const scaledPaddingY = (12 * labelScale) / 100; // py-3 = 12px
  const scaledMaxWidth = (350 * labelScale) / 100; // max-w-[350px]

  const isAnnotationVisible = (annotation: Annotation): boolean => {
    // If no frame constraints, always visible
    if (
      annotation?.appearFrame === undefined &&
      annotation?.disappearFrame === undefined
    ) {
      return true;
    }

    // Check frame-based visibility
    const isAfterAppearFrame =
      annotation?.appearFrame === undefined ||
      currentFrame >= annotation?.appearFrame;

    const isBeforeDisappearFrame =
      annotation?.disappearFrame === undefined ||
      currentFrame < annotation?.disappearFrame;

    return isAfterAppearFrame && isBeforeDisappearFrame;
  };

  useEffect(() => {
    annotations?.forEach((annotation, index) => {
      const element = annotationRefs?.current?.get(index);
      if (!element) return;

      // Always use frame-based visibility logic
      const visible = isAnnotationVisible(annotation);

      console.log(`🔍 Annotation ${index} "${annotation.label}": visible=${visible}, frame=${currentFrame}, appear=${annotation.appearFrame}, disappear=${annotation.disappearFrame}`);

      if (visible) {
        element.classList.remove(
          "opacity-0",
          "invisible",
          "pointer-events-none"
        );
        element.classList.add("opacity-100", "visible", "pointer-events-auto");
        element.dataset.visibility = "visible";
      } else {
        element?.classList?.remove(
          "opacity-100",
          "visible",
          "pointer-events-auto"
        );
        element?.classList?.add(
          "opacity-0",
          "invisible",
          "pointer-events-none"
        );
        element.dataset.visibility = "hidden";
      }
    });
  }, [annotations, currentFrame]);

  return (
    <>
      {Array.isArray(annotations) &&
        annotations.map((annotation, index) => {
          const formattedLabel = formatLabelText(annotation?.label || "");

          return (
            <Button
              key={`hotspot-${index}`}
              ref={(el) => {
                if (el) annotationRefs?.current?.set(index, el);
              }}
              slot={`hotspot-${index}`}
              className={cn(
                "p-0 h-auto",
                "bg-gray-800/60 hover:bg-gray-800/100 text-white rounded-lg",
                "w-auto",
                "text-left whitespace-pre-wrap break-words leading-tight",
                "inline-block transition-opacity duration-300",
                "font-normal",
                isAnnotationVisible(annotation)
                  ? "opacity-100 visible pointer-events-auto"
                  : "opacity-0 invisible pointer-events-none"
              )}
              style={{
                fontSize: `${scaledFontSize}px`,
                paddingLeft: `${scaledPaddingX}px`,
                paddingRight: `${scaledPaddingX}px`,
                paddingTop: `${scaledPaddingY}px`,
                paddingBottom: `${scaledPaddingY}px`,
                maxWidth: `${scaledMaxWidth}px`,
              }}
              data-position={`${annotation?.position?.x || 0} ${
                annotation?.position?.y || 0
              } ${annotation?.position?.z || 0}`}
              data-visibility-attribute="visible"
              data-frame-range={
                annotation?.appearFrame !== undefined
                  ? `${annotation?.appearFrame}-${annotation?.disappearFrame}`
                  : "always"
              }
            >
              {formattedLabel}
            </Button>
          );
        })}
    </>
  );
};

export default ModelAnnotations;
