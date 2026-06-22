import React, { useEffect, useRef } from "react";

/** Toca sons transmitidos pelo mestre (todos os participantes). */
export default function SessionBroadcastAudio({ session }) {
  const audioRef = useRef(null);
  const lastAt = useRef(0);

  useEffect(() => {
    const url = session?.roundTracker?.activeSoundUrl;
    const at = session?.roundTracker?.activeSoundAt || 0;
    if (!url || at <= lastAt.current) return;
    lastAt.current = at;
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
    }
  }, [session?.roundTracker?.activeSoundUrl, session?.roundTracker?.activeSoundAt]);

  return <audio ref={audioRef} className="session-hidden-audio" preload="auto" />;
}
