declare namespace YT {
  interface Player {
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
  }

  interface PlayerOptions {
    height?: string;
    width?: string;
    videoId?: string;
    playerVars?: object;
    events?: {
      onReady?: (event: { target: Player }) => void;
      onStateChange?: (event: { data: PlayerState; target: Player }) => void;
      onError?: (event: { data: number; target: Player }) => void;
      onPlaybackQualityChange?: (event: { data: string; target: Player }) => void;
      onPlaybackRateChange?: (event: { data: number; target: Player }) => void;
    };
  }

  interface PlayerConstructor {
    new (elementId: string, options: PlayerOptions): Player;
  }

  const Player: PlayerConstructor;

  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
}