import { useState, useEffect } from "react";

/**
 * Custom hook for detecting screen orientation
 * @returns {Object} An object containing orientation states and values
 * - isPortrait: true if height > width
 * - isLandscape: true if width >= height
 * - orientation: string 'portrait' or 'landscape'
 * - width: current window width
 * - height: current window height
 */
export const useOrientation = () => {
  const [state, setState] = useState({
    isPortrait: false,
    isLandscape: true,
    isMobileLandscape: false,
    orientation: "landscape",
    width: 0,
    height: 0,
    toolbarPosition: { x: "0.5vw", bottom: "20vh" },
  });

  const getBottomPosition = (viewportHeight: number) => {
    let dynamicBottom: string;
    if (viewportHeight >= 680) {
      dynamicBottom = "20vh";
    } else if (viewportHeight >= 580) {
      dynamicBottom = "25vh";
    } else if (viewportHeight >= 480) {
      dynamicBottom = "30vh";
    } else if (viewportHeight >= 380) {
      dynamicBottom = "35vh";
    } else if (viewportHeight >= 320) {
      dynamicBottom = "40vh";
    } else {
      dynamicBottom = "60vh";
    }
    return dynamicBottom;
  };

  useEffect(() => {
    // Initial check function
    const checkOrientation = () => {
      const width = window?.innerWidth || 0;
      const height = window?.innerHeight || 0;
      const isPortrait = height > width || width < 850;
      const isMobileLandscape = width < 950 && height < width;

      const dynamicBottom = getBottomPosition(height);

      setState({
        isPortrait,
        isLandscape: !isPortrait,
        isMobileLandscape,
        orientation: isPortrait ? "portrait" : "landscape",
        width,
        height,
        toolbarPosition: { x: "0.5vw", bottom: dynamicBottom },
      });
    };

    checkOrientation();

    window?.addEventListener("resize", checkOrientation);

    window?.screen?.orientation?.addEventListener?.("change", checkOrientation);

    return () => {
      window?.removeEventListener("resize", checkOrientation);
      window?.screen?.orientation?.removeEventListener?.(
        "change",
        checkOrientation
      );
    };
  }, []);

  return state;
};

export default useOrientation;
