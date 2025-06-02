
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Timer, Play, Pause, RotateCcw, Music, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RetroTimerProps {
  isAnonymousUser?: boolean;
}

export const RetroTimer: React.FC<RetroTimerProps> = ({ isAnonymousUser = false }) => {
  const [minutes, setMinutes] = useState(15);
  const [seconds, setSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [volume, setVolume] = useState(0.3);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Initialize audio with a calm ambient loop
  useEffect(() => {
    // Create a simple ambient tone using Web Audio API
    const createAmbientMusic = () => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator1.type = 'sine';
      oscillator1.frequency.setValueAtTime(220, audioContext.currentTime); // A3
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(330, audioContext.currentTime); // E4
      
      gainNode.gain.setValueAtTime(volume * 0.1, audioContext.currentTime);
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      return { audioContext, oscillator1, oscillator2, gainNode };
    };

    if (musicEnabled && isRunning) {
      try {
        const music = createAmbientMusic();
        music.oscillator1.start();
        music.oscillator2.start();
        
        // Store cleanup function
        audioRef.current = {
          stop: () => {
            music.oscillator1.stop();
            music.oscillator2.stop();
            music.audioContext.close();
          }
        } as any;
      } catch (error) {
        console.log('Web Audio API not supported');
      }
    }

    return () => {
      if (audioRef.current && (audioRef.current as any).stop) {
        (audioRef.current as any).stop();
      }
    };
  }, [musicEnabled, isRunning, volume]);

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
                disabled={isAnonymousUser}
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
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="music"
                      checked={musicEnabled}
                      onChange={(e) => setMusicEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="music" className="text-sm">
                      Play calm background music
                    </label>
                  </div>
                  
                  {musicEnabled && (
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
      </CardContent>
    </Card>
  );
};
