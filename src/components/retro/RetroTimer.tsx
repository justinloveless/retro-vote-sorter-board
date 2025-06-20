import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Timer, Play, Pause, RotateCcw, Music, VolumeX, Upload, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TimerState } from '@/hooks/useRetroBoard';

interface RetroTimerProps {
  timerState: TimerState;
  updateTimerState: (state: Partial<TimerState>) => void;
}

export const RetroTimer: React.FC<RetroTimerProps> = ({ timerState, updateTimerState }) => {
  const { user } = useAuth();
  const isAnonymousUser = !user;
  
  const { isRunning, duration, startTime } = timerState;

  const [minutes, setMinutes] = useState(Math.floor(duration / 60));
  const [seconds, setSeconds] = useState(duration % 60);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(0.3);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [usingDefaultAudio, setUsingDefaultAudio] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  // Audio playback logic
  useEffect(() => {
    if (musicEnabled && isRunning && uploadedAudioUrl && audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.loop = true;
      if (audioRef.current.paused) {
        audioRef.current.play().catch(error => console.log('Audio playback failed:', error));
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [musicEnabled, isRunning, uploadedAudioUrl, volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const newTimeLeft = Math.round(duration - elapsed);
        
        if (newTimeLeft <= 0) {
          setTimeLeft(0);
          // Only one client should send the update
          if(isRunning) {
            updateTimerState({ isRunning: false });
            toast({
                title: "Time's up!",
                description: "Your retro timer has finished.",
            });
          }
        } else {
            setTimeLeft(newTimeLeft);
        }
      }, 1000);
    } else {
        setTimeLeft(duration);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, startTime, duration, updateTimerState, toast]);
  
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

    if (usingDefaultAudio) {
      toast({
        title: "Cannot delete default audio",
        description: "You can upload your own audio file to replace it.",
        variant: "destructive",
      });
      return;
    }

    try {
      const urlParts = uploadedAudioUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      const { error } = await supabase.storage
        .from('retro-audio')
        .remove([fileName]);

      if (error) throw error;

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

  const startTimer = () => {
    const newDuration = minutes * 60 + seconds;
    updateTimerState({
      isRunning: true,
      startTime: Date.now(),
      duration: newDuration,
    });
    setIsDialogOpen(false);
  };

  const pauseTimer = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const remainingDuration = duration - elapsed;
    updateTimerState({
      isRunning: false,
      duration: remainingDuration > 0 ? remainingDuration : 0,
      startTime: 0
    });
  };

  const resetTimer = () => {
    const newDuration = minutes * 60 + seconds;
    updateTimerState({
      isRunning: false,
      duration: newDuration,
      startTime: 0,
    });
    setTimeLeft(newDuration);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMusic = () => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(previousVolume);
    } else {
      setPreviousVolume(volume);
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    } else if (newVolume === 0 && !isMuted) {
      setIsMuted(true);
    }
  };

  return (
    <Card className="bg-white/50 dark:bg-gray-800/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Timer className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          
          {isRunning || (timeLeft > 0 && timeLeft < duration) ? (
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
                title={isMuted ? 'Unmute music' : 'Mute music'}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Music className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={isAnonymousUser}
                >
                  Set Timer
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
                              {isUploading ? "Uploading..." : (<><Upload className="h-4 w-4 mr-1" />Upload</>)}
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
                          {isUploading ? "Uploading..." : (<><Upload className="h-4 w-4 mr-1" />Upload</>)}
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
        </div>
        
        {uploadedAudioUrl && (
          <audio
            ref={audioRef}
            src={uploadedAudioUrl}
            preload="metadata"
            style={{ display: 'none' }}
          />
        )}
      </CardContent>
    </Card>
  );
};
