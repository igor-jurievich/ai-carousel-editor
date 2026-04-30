"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export function AppToaster() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(media.matches);
    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  return (
    <Toaster
      position={isMobile ? "top-center" : "bottom-right"}
      offset={isMobile ? 60 : 24}
      toastOptions={{
        style: {
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "14px"
        }
      }}
    />
  );
}
