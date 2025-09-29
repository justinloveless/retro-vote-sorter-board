
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Timer, Play, Pause, RotateCcw, Music, VolumeX, Upload, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { getRetroAudioPublicUrl, uploadRetroAudio, deleteRetroAudio } from '@/lib/dataClient';

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
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(0.3);
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
  const defaultAudioUrl = `${getRetroAudioPublicUrl(defaultAudioFileName)}`;

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
        // Set volume based on mute state
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.loop = true;

        // Only start playing if not already playing
        if (audioRef.current.paused) {
          audioRef.current.play().catch(error => {
            console.log('Audio playback failed:', error);
            toast({
              title: "Audio playback failed",
              description: "Could not play background music.",
              variant: "destructive",
            });
          });
        }
      }
    } else if (audioRef.current && !isRunning) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    return () => {
      if (audioRef.current && !isRunning) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [musicEnabled, isRunning, uploadedAudioUrl, volume, isMuted]);

  // Update audio volume when volume or mute state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

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
      const { fileName, publicUrl } = await uploadRetroAudio(user.id, audioFile);
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

      await deleteRetroAudio(fileName);

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
