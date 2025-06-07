import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useBackground, PRESET_BACKGROUNDS, PresetKey } from '@/contexts/BackgroundContext';
import { Palette } from 'lucide-react';
import { BackgroundPreview } from './BackgroundPreview';

export const BackgroundSettings = () => {
    const { preference, updatePreference } = useBackground();

    const handlePresetChange = (presetKey: PresetKey) => {
        updatePreference({ preset: presetKey });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Background Appearance
                </CardTitle>
            </CardHeader>
            <CardContent>
                <RadioGroup
                    value={preference.preset}
                    onValueChange={(value) => handlePresetChange(value as PresetKey)}
                    className="flex space-x-2 p-2 overflow-x-auto"
                >
                    {Object.entries(PRESET_BACKGROUNDS).map(([key, { name }]) => (
                        <div key={key} className="flex-shrink-0">
                            <RadioGroupItem value={key} id={key} className="peer sr-only" />
                            <Label
                                htmlFor={key}
                                className="flex flex-col items-center gap-2 rounded-md border-2 border-muted bg-transparent p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                            >
                                <BackgroundPreview presetKey={key as PresetKey} />
                                <span className="text-sm font-medium">{name}</span>
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </CardContent>
        </Card>
    );
}; 