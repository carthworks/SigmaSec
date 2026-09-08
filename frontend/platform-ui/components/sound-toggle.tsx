"use client";

import * as React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundMuted, toggleSound } from "@/lib/sound-cues";
import { Button } from "@/components/ui/button";

export function SoundToggle() {
  const [muted, setMuted] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setMuted(isSoundMuted());

    const handleSync = (e: any) => {
      setMuted(e.detail?.muted ?? isSoundMuted());
    };
    window.addEventListener("sigmasec-sound-toggle", handleSync);
    return () => window.removeEventListener("sigmasec-sound-toggle", handleSync);
  }, []);

  const handleToggle = () => {
    const isNowMuted = !toggleSound();
    setMuted(isNowMuted);
  };

  const getTitle = () => {
    if (!mounted) return "Audio Cues";
    return muted ? "Audio cues muted (Click to enable)" : "Audio cues active (Click to mute)";
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className="rounded-full h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative"
      title={getTitle()}
      aria-label={getTitle()}
    >
      {mounted && muted ? (
        <VolumeX className="h-[1.05rem] w-[1.05rem] text-muted-foreground/60" />
      ) : (
        <Volume2 className="h-[1.05rem] w-[1.05rem] text-cyan-500 dark:text-cyan-400" />
      )}
      <span className="sr-only">{getTitle()}</span>
    </Button>
  );
}
