import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useBackground, PRESET_BACKGROUNDS, PresetKey } from '@/contexts/BackgroundContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Palette } from 'lucide-react';
import { BackgroundPreview } from './BackgroundPreview';

export const AppearanceSettings = () => {
  const { theme, setTheme } = useTheme();
  const { preference, updatePreference } = useBackground();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Appearance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Theme</Label>
          <RadioGroup value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark')} className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="light" id="light" />
              <Label htmlFor="light">Light</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dark" id="dark" />
              <Label htmlFor="dark">Dark</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Background</Label>
          <RadioGroup
            value={preference.preset}
            onValueChange={(value) => updatePreference({ preset: value as PresetKey })}
            className="flex space-x-2 p-2 overflow-x-auto"
          >
            {Object.entries(PRESET_BACKGROUNDS).map(([key, { name }]) => (
              <div key={key} className="flex-shrink-0">
                <RadioGroupItem value={key} id={`bg-${key}`} className="peer sr-only" />
                <Label
                  htmlFor={`bg-${key}`}
                  className="flex flex-col items-center gap-2 rounded-md border-2 border-muted bg-transparent p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                >
                  <BackgroundPreview presetKey={key as PresetKey} />
                  <span className="text-sm font-medium">{name}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
};
