
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Timer, Play, Pause, RotateCcw, Music, VolumeX, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface RetroTimerProps {
  presenceChannel?: any;
  boardConfig?: {
    timer_started_at?: string | null;
    timer_duration_seconds?: number;
    timer_time_left_seconds?: number;
    timer_is_running?: boolean;
    timer_music_enabled?: boolean;
    timer_music_offset_seconds?: number;
    timer_alarm_enabled?: boolean;
  } | null;
  onPersistTimerState?: (config: {
    timer_started_at?: string | null;
    timer_duration_seconds?: number;
    timer_time_left_seconds?: number;
    timer_is_running?: boolean;
    timer_music_enabled?: boolean;
    timer_music_offset_seconds?: number;
    timer_alarm_enabled?: boolean;
  }) => void;
}

interface TimerBroadcastPayload {
  action: 'start' | 'pause' | 'reset';
  startedAt: string | null;
  durationSeconds: number;
  timeLeft: number;
  isRunning: boolean;
  musicEnabled: boolean;
  musicOffsetSeconds: number;
  alarmEnabled: boolean;
}

const TIMER_VOLUME_KEY = 'retroTimerVolume';
const TIMER_MUTED_KEY = 'retroTimerMuted';
const TIMER_PREVIOUS_VOLUME_KEY = 'retroTimerPreviousVolume';
const TIMER_AUDIO_PRIMED_KEY = 'retroTimerAudioPrimed';

const getTimeLeftFromStart = (startedAt: string, durationSeconds: number) => {
  const elapsedSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(durationSeconds - elapsedSeconds, 0);
};

const getSyncedMusicPosition = (
  startedAt: string,
  musicOffsetSeconds: number,
  audioDuration?: number
) => {
  const elapsedSeconds = (Date.now() - new Date(startedAt).getTime()) / 1000;
  const rawPosition = Math.max(musicOffsetSeconds + elapsedSeconds, 0);
  if (audioDuration && Number.isFinite(audioDuration) && audioDuration > 0) {
    return rawPosition % audioDuration;
  }
  return rawPosition;
};

const playTimerAlarm = () => {
  if (typeof window === 'undefined') return;
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return;

  const ctx = new AudioContextCtor();
  const sequence = [0, 0.18, 0.36];

  sequence.forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime + offset);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + 0.15);
  });

  window.setTimeout(() => {
    ctx.close().catch(() => {});
  }, 1000);
};

export const RetroTimer: React.FC<RetroTimerProps> = ({
  presenceChannel,
  boardConfig,
  onPersistTimerState,
}) => {
  const { user } = useAuth();
  const isAnonymousUser = !user;
  
  const [minutes, setMinutes] = useState(15);
  const [seconds, setSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicOffsetSeconds, setMusicOffsetSeconds] = useState(0);
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [volume, setVolume] = useState(() => {
    if (typeof window === 'undefined') return 0.3;
    const storedVolume = Number(window.localStorage.getItem(TIMER_VOLUME_KEY));
    return Number.isFinite(storedVolume) ? Math.max(0, Math.min(1, storedVolume)) : 0.3;
  });
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(TIMER_MUTED_KEY) === 'true';
  });
  const [audioInteractionRequired, setAudioInteractionRequired] = useState(false);
  const [audioPrimed, setAudioPrimed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(TIMER_AUDIO_PRIMED_KEY) === 'true';
  });
  const [previousVolume, setPreviousVolume] = useState(() => {
    if (typeof window === 'undefined') return 0.3;
    const storedPreviousVolume = Number(window.localStorage.getItem(TIMER_PREVIOUS_VOLUME_KEY));
    return Number.isFinite(storedPreviousVolume) ? Math.max(0, Math.min(1, storedPreviousVolume)) : 0.3;
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [usingDefaultAudio, setUsingDefaultAudio] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Default audio file configuration
  const defaultAudioFileName = "retro-music-7c2a52ff-cea8-4a3f-9de9-0f2f744be625-1748877023437.mp3";
  const defaultAudioUrl = `${supabase.storage.from('retro-audio').getPublicUrl(defaultAudioFileName).data.publicUrl}`;

  // Initialize with default audio
  useEffect(() => {
    if (!uploadedAudioUrl && !isAnonymousUser) {
      setUploadedAudioUrl(defaultAudioUrl);
      setUploadedFileName("Default Background Music");
      setUsingDefaultAudio(true);
    }
  }, [defaultAudioUrl, uploadedAudioUrl, isAnonymousUser]);

  // Initialize audio playback - only control volume, not play/pause based on mute
  useEffect(() => {
    if (musicEnabled && isRunning && uploadedAudioUrl) {
      if (audioRef.current) {
        if (startedAt) {
          const targetPosition = getSyncedMusicPosition(
            startedAt,
            musicOffsetSeconds,
            audioRef.current.duration
          );
          if (Math.abs((audioRef.current.currentTime || 0) - targetPosition) > 0.75) {
            audioRef.current.currentTime = targetPosition;
          }
        }

        // Set volume based on mute state
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.loop = true;
        
        // Only start playing if not already playing
        if (audioRef.current.paused) {
          audioRef.current.play().then(() => {
            setAudioInteractionRequired(false);
          }).catch(error => {
            console.log('Audio playback failed:', error);
            setPreviousVolume(volume);
            setIsMuted(true);
            setAudioInteractionRequired(true);
          });
        }
      }
    } else if (audioRef.current && !isRunning) {
      audioRef.current.pause();
      if (timeLeft === 0) {
        audioRef.current.currentTime = 0;
      }
    }

    return () => {
      if (audioRef.current && !isRunning) {
        audioRef.current.pause();
        if (timeLeft === 0) {
          audioRef.current.currentTime = 0;
        }
      }
    };
  }, [musicEnabled, isRunning, uploadedAudioUrl, volume, isMuted, startedAt, musicOffsetSeconds, timeLeft]);

  // Update audio volume when volume or mute state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Persist per-browser volume controls.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TIMER_VOLUME_KEY, volume.toString());
    window.localStorage.setItem(TIMER_MUTED_KEY, String(isMuted));
    window.localStorage.setItem(TIMER_PREVIOUS_VOLUME_KEY, previousVolume.toString());
  }, [volume, isMuted, previousVolume]);

  // Prime audio after any interaction so future timer starts can autoplay.
  useEffect(() => {
    if (audioPrimed || !uploadedAudioUrl || !audioRef.current) return;
    const primeAudio = () => {
      if (!audioRef.current || audioPrimed) return;
      const previousMuted = audioRef.current.muted;
      const previousVolume = audioRef.current.volume;
      audioRef.current.muted = true;
      audioRef.current.volume = 0;
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.muted = previousMuted;
          audioRef.current.volume = previousVolume;
        }
        setAudioPrimed(true);
        window.localStorage.setItem(TIMER_AUDIO_PRIMED_KEY, 'true');
      }).catch((error) => {
        console.error('Audio priming failed:', error);
      });
    };

    window.addEventListener('pointerdown', primeAudio, { once: true });
    window.addEventListener('keydown', primeAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', primeAudio);
      window.removeEventListener('keydown', primeAudio);
    };
  }, [audioPrimed, uploadedAudioUrl]);

  const applyTimerState = useCallback((payload: TimerBroadcastPayload) => {
    setStartedAt(payload.startedAt);
    setDurationSeconds(payload.durationSeconds);
    setIsRunning(payload.isRunning);
    setMusicEnabled(payload.musicEnabled);
    setMusicOffsetSeconds(payload.musicOffsetSeconds);
    setAlarmEnabled(payload.alarmEnabled);
    if (payload.isRunning && payload.startedAt) {
      setTimeLeft(getTimeLeftFromStart(payload.startedAt, payload.durationSeconds));
      return;
    }
    setTimeLeft(payload.timeLeft);
  }, []);

  const persistTimerState = useCallback((payload: TimerBroadcastPayload) => {
    if (!onPersistTimerState) return;
    onPersistTimerState({
      timer_started_at: payload.startedAt,
      timer_duration_seconds: payload.durationSeconds,
      timer_time_left_seconds: payload.timeLeft,
      timer_is_running: payload.isRunning,
      timer_music_enabled: payload.musicEnabled,
      timer_music_offset_seconds: payload.musicOffsetSeconds,
      timer_alarm_enabled: payload.alarmEnabled,
    });
  }, [onPersistTimerState]);

  const broadcastTimerState = useCallback(async (payload: TimerBroadcastPayload) => {
    if (!presenceChannel) return;
    try {
      await presenceChannel.send({
        type: 'broadcast',
        event: 'retro-timer-changed',
        payload,
      });
    } catch (error) {
      console.error('Failed to broadcast timer state:', error);
    }
  }, [presenceChannel]);

  useEffect(() => {
    const timerBroadcastHandler = (event: Event) => {
      const customEvent = event as CustomEvent<TimerBroadcastPayload | undefined>;
      if (!customEvent.detail) return;
      applyTimerState(customEvent.detail);
    };

    window.addEventListener('retro-timer-changed', timerBroadcastHandler);
    return () => {
      window.removeEventListener('retro-timer-changed', timerBroadcastHandler);
    };
  }, [applyTimerState]);

  useEffect(() => {
    if (!boardConfig) return;
    const savedTimeLeft = boardConfig.timer_time_left_seconds ?? 0;
    const savedDuration = boardConfig.timer_duration_seconds ?? savedTimeLeft;
    const savedPayload: TimerBroadcastPayload = {
      action: savedTimeLeft > 0 ? 'pause' : 'reset',
      startedAt: boardConfig.timer_started_at ?? null,
      durationSeconds: savedDuration,
      timeLeft: savedTimeLeft,
      isRunning: !!boardConfig.timer_is_running,
      musicEnabled: !!boardConfig.timer_music_enabled,
      musicOffsetSeconds: boardConfig.timer_music_offset_seconds ?? 0,
      alarmEnabled: boardConfig.timer_alarm_enabled ?? true,
    };
    applyTimerState(savedPayload);
  }, [boardConfig, applyTimerState]);

  // Timer logic (latency-aware while running)
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        if (startedAt && durationSeconds > 0) {
          const calculatedTimeLeft = getTimeLeftFromStart(startedAt, durationSeconds);
          if (calculatedTimeLeft <= 0) {
            setIsRunning(false);
            setStartedAt(null);
            setDurationSeconds(0);
            setMusicOffsetSeconds(0);
            persistTimerState({
              action: 'reset',
              startedAt: null,
              durationSeconds: 0,
              timeLeft: 0,
              isRunning: false,
              musicEnabled,
              musicOffsetSeconds: 0,
              alarmEnabled,
            });
            toast({
              title: "Time's up!",
              description: "Your retro timer has finished.",
            });
            if (alarmEnabled) {
              playTimerAlarm();
            }
            setTimeLeft(0);
            return;
          }
          setTimeLeft(calculatedTimeLeft);
          return;
        }

        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setMusicOffsetSeconds(0);
            persistTimerState({
              action: 'reset',
              startedAt: null,
              durationSeconds: 0,
              timeLeft: 0,
              isRunning: false,
              musicEnabled,
              musicOffsetSeconds: 0,
              alarmEnabled,
            });
            toast({
              title: "Time's up!",
              description: "Your retro timer has finished.",
            });
            if (alarmEnabled) {
              playTimerAlarm();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft, toast, startedAt, durationSeconds, musicEnabled, alarmEnabled, persistTimerState]);

  const handleAudioUpload = async () => {
    if (!audioFile || !user) return;

    setIsUploading(true);
    try {
      const fileExt = audioFile.name.split('.').pop();
      const fileName = `retro-music-${user.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('retro-audio')
        .upload(fileName, audioFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('retro-audio')
        .getPublicUrl(fileName);

      setUploadedAudioUrl(publicUrl);
      setUploadedFileName(audioFile.name);
      setUsingDefaultAudio(false);
      
      toast({
        title: "Audio uploaded successfully",
        description: "Your background music is ready to use.",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Could not upload audio file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setAudioFile(null);
    }
  };

  const handleDeleteAudio = async () => {
    if (!uploadedAudioUrl || !user) return;

    // Don't allow deleting the default audio
    if (usingDefaultAudio) {
      toast({
        title: "Cannot delete default audio",
        description: "You can upload your own audio file to replace it.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Extract file path from URL
      const urlParts = uploadedAudioUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      const { error } = await supabase.storage
        .from('retro-audio')
        .remove([fileName]);

      if (error) throw error;

      // Reset to default audio
      setUploadedAudioUrl(defaultAudioUrl);
      setUploadedFileName("Default Background Music");
      setUsingDefaultAudio(true);
      setMusicEnabled(false);
      
      toast({
        title: "Audio deleted",
        description: "Reverted to default background music.",
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: "Could not delete audio file.",
        variant: "destructive",
      });
    }
  };

  const startTimer = async () => {
    const nextDurationSeconds = timeLeft === 0 ? (minutes * 60 + seconds) : timeLeft;
    const nextStartedAt = new Date().toISOString();
    const nextMusicOffsetSeconds = timeLeft === 0 ? 0 : musicOffsetSeconds;
    const nextPayload: TimerBroadcastPayload = {
      action: 'start',
      startedAt: nextStartedAt,
      durationSeconds: nextDurationSeconds,
      timeLeft: nextDurationSeconds,
      isRunning: true,
      musicEnabled,
      musicOffsetSeconds: nextMusicOffsetSeconds,
      alarmEnabled,
    };
    applyTimerState(nextPayload);
    await broadcastTimerState(nextPayload);
    persistTimerState(nextPayload);
    setIsDialogOpen(false);
  };

  const pauseTimer = async () => {
    const nextTimeLeft = startedAt && durationSeconds > 0
      ? getTimeLeftFromStart(startedAt, durationSeconds)
      : timeLeft;
    const nextMusicOffsetSeconds = startedAt
      ? getSyncedMusicPosition(startedAt, musicOffsetSeconds, audioRef.current?.duration)
      : musicOffsetSeconds;
    const nextPayload: TimerBroadcastPayload = {
      action: 'pause',
      startedAt: null,
      durationSeconds: 0,
      timeLeft: nextTimeLeft,
      isRunning: false,
      musicEnabled,
      musicOffsetSeconds: nextMusicOffsetSeconds,
      alarmEnabled,
    };
    applyTimerState(nextPayload);
    await broadcastTimerState(nextPayload);
    persistTimerState(nextPayload);
  };

  const resetTimer = async () => {
    const nextPayload: TimerBroadcastPayload = {
      action: 'reset',
      startedAt: null,
      durationSeconds: 0,
      timeLeft: 0,
      isRunning: false,
      musicEnabled,
      musicOffsetSeconds: 0,
      alarmEnabled,
    };
    applyTimerState(nextPayload);
    await broadcastTimerState(nextPayload);
    persistTimerState(nextPayload);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMusic = () => {
    if (audioInteractionRequired && isMuted) {
      const restoredVolume = previousVolume > 0 ? previousVolume : volume;
      setIsMuted(false);
      setVolume(restoredVolume);
      setAudioInteractionRequired(false);
      if (audioRef.current && musicEnabled && isRunning) {
        audioRef.current.play().catch((error) => {
          console.error('Audio playback failed after manual unmute:', error);
          setPreviousVolume(restoredVolume);
          setIsMuted(true);
          setAudioInteractionRequired(true);
        });
      }
      return;
    }

    if (isMuted) {
      // Unmute: restore previous volume
      setIsMuted(false);
      setVolume(previousVolume);
    } else {
      // Mute: save current volume and set to 0
      setPreviousVolume(volume);
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (newVolume > 0) {
      setPreviousVolume(newVolume);
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    } else if (newVolume === 0 && !isMuted) {
      setIsMuted(true);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {timeLeft > 0 ? (
        <>
          <Timer className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <div className="flex items-center gap-2">
              <span className="text-lg font-mono font-bold">
                {formatTime(timeLeft)}
              </span>
              
              <Button
                size="sm"
                variant="outline"
                onClick={isRunning ? pauseTimer : startTimer}
                disabled={isAnonymousUser}
              >
                {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={resetTimer}
                disabled={isAnonymousUser}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={toggleMusic}
                disabled={isAnonymousUser || !uploadedAudioUrl}
                className={musicEnabled && !isMuted ? 'bg-indigo-100 dark:bg-indigo-900' : ''}
                title={audioInteractionRequired ? 'Interact with the page to enable music playback' : (isMuted ? 'Unmute music' : 'Mute music')}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Music className="h-4 w-4" />}
                {audioInteractionRequired && (
                  <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
                )}
              </Button>

              {musicEnabled && uploadedAudioUrl && (
                <div className="flex items-center gap-2 min-w-40">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-24"
                    aria-label="Timer music volume"
                  />
                  <span className="text-xs text-gray-500 w-10 text-right">
                    {isMuted ? 0 : Math.round(volume * 100)}%
                  </span>
                </div>
              )}
            </div>
        </>
      ) : (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              disabled={isAnonymousUser}
              aria-label="Set timer"
              title="Set timer"
            >
              <Timer className="h-4 w-4" />
            </Button>
          </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Retro Timer</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <label className="text-sm font-medium">Minutes</label>
                      <Input
                        type="number"
                        min="0"
                        max="120"
                        value={minutes}
                        onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Seconds</label>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={seconds}
                        onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-20"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Background Music</label>
                    
                    {uploadedAudioUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded border">
                          <span className="text-sm text-green-700 dark:text-green-300">
                            🎵 {uploadedFileName || 'Audio file uploaded'}
                            {usingDefaultAudio && (
                              <span className="text-xs text-gray-500 ml-2">(Default)</span>
                            )}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDeleteAudio}
                            className="h-6 w-6 p-0"
                            disabled={usingDefaultAudio}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        {/* Upload new audio option */}
                        <div className="border-t pt-2">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            Upload your own audio file:
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                              className="text-sm flex-1"
                              disabled={isUploading}
                            />
                            <Button
                              size="sm"
                              onClick={handleAudioUpload}
                              disabled={!audioFile || isUploading}
                            >
                              {isUploading ? (
                                "Uploading..."
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-1" />
                                  Upload
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                          className="text-sm flex-1"
                          disabled={isUploading}
                        />
                        <Button
                          size="sm"
                          onClick={handleAudioUpload}
                          disabled={!audioFile || isUploading}
                        >
                          {isUploading ? (
                            "Uploading..."
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-1" />
                              Upload
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500">
                      Supported formats: MP3, WAV, OGG, M4A
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="music"
                      checked={musicEnabled}
                      onChange={(e) => setMusicEnabled(e.target.checked)}
                      className="rounded"
                      disabled={!uploadedAudioUrl}
                    />
                    <label htmlFor="music" className="text-sm">
                      Play background music {!uploadedAudioUrl && '(upload audio first)'}
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="timer-alarm"
                      checked={alarmEnabled}
                      onChange={(e) => setAlarmEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="timer-alarm" className="text-sm">
                      Play alarm when timer ends
                    </label>
                  </div>
                  
                  {musicEnabled && uploadedAudioUrl && (
                    <div>
                      <label className="text-sm font-medium">
                        Volume {isMuted && '(Muted)'}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Volume: {isMuted ? 0 : Math.round(volume * 100)}%
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Note: Volume control is individual - other users won't hear your changes
                      </div>
                    </div>
                  )}
                  
                  <Button onClick={startTimer} className="w-full">
                    Start Timer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
      )}

      {isAnonymousUser && (
        <span className="text-xs text-gray-500">
          (Sign in to use timer)
        </span>
      )}

      {/* Hidden audio element for playback */}
      {uploadedAudioUrl && (
        <audio
          ref={audioRef}
          src={uploadedAudioUrl}
          preload="metadata"
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
};
