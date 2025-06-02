
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Timer, Play, Pause, RotateCcw, Music, VolumeX, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export const RetroTimer: React.FC = () => {
  const { user } = useAuth();
  const isAnonymousUser = !user;
  
  const [minutes, setMinutes] = useState(15);
  const [seconds, setSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Initialize audio playback
  useEffect(() => {
    if (musicEnabled && isRunning && uploadedAudioUrl) {
      if (audioRef.current) {
        audioRef.current.volume = volume;
        audioRef.current.loop = true;
        audioRef.current.play().catch(error => {
          console.log('Audio playback failed:', error);
          toast({
            title: "Audio playback failed",
            description: "Could not play background music.",
            variant: "destructive",
          });
        });
      }
    } else if (audioRef.current && !isRunning) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [musicEnabled, isRunning, uploadedAudioUrl, volume]);

  // Timer logic
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            toast({
              title: "Time's up!",
              description: "Your retro timer has finished.",
            });
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
  }, [isRunning, timeLeft, toast]);

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
    }
  };

  const startTimer = () => {
    if (timeLeft === 0) {
      setTimeLeft(minutes * 60 + seconds);
    }
    setIsRunning(true);
    setIsDialogOpen(false);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(0);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMusic = () => {
    setMusicEnabled(!musicEnabled);
  };

  return (
    <Card className="bg-white/50 dark:bg-gray-800/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Timer className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          
          {timeLeft > 0 ? (
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
                className={musicEnabled ? 'bg-indigo-100 dark:bg-indigo-900' : ''}
              >
                {musicEnabled ? <Music className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
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
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Background Music</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                        className="text-sm"
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
                    {uploadedAudioUrl && (
                      <p className="text-xs text-green-600">Audio file uploaded successfully!</p>
                    )}
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
                      <label className="text-sm font-medium">Volume</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-full"
                      />
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
        
        {/* Hidden audio element for playback */}
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
