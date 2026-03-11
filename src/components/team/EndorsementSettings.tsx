import React, { useState } from 'react';
import { Award, Plus, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useEndorsementTypes } from '@/hooks/useEndorsementTypes';

interface EndorsementSettingsProps {
  teamId: string;
}

export const EndorsementSettings: React.FC<EndorsementSettingsProps> = ({ teamId }) => {
  const { types, settings, loading, addType, updateType, deleteType, updateSettings, seedDefaults } = useEndorsementTypes(teamId);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('🏆');
  const [maxEndorsements, setMaxEndorsements] = useState<number>(settings?.max_endorsements_per_user_per_board ?? 3);

  React.useEffect(() => {
    if (settings) setMaxEndorsements(settings.max_endorsements_per_user_per_board);
  }, [settings]);

  const handleAddType = async () => {
    if (!newName.trim()) return;
    await addType(newName.trim(), newDesc.trim(), newIcon.trim());
    setNewName('');
    setNewDesc('');
    setNewIcon('🏆');
  };

  const handleSaveMax = async () => {
    await updateSettings(maxEndorsements);
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading endorsement settings...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Endorsement Settings
        </CardTitle>
        <CardDescription>Configure endorsement types and limits for your team</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Max endorsements */}
        <div className="space-y-2">
          <Label>Max endorsements per person per board</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={1}
              max={50}
              value={maxEndorsements}
              onChange={e => setMaxEndorsements(Number(e.target.value))}
              className="w-24"
            />
            <Button size="sm" variant="outline" onClick={handleSaveMax}>Save</Button>
          </div>
        </div>

        {/* Existing types */}
        <div className="space-y-2">
          <Label>Endorsement Types</Label>
          {types.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">
              No endorsement types yet.
              <Button variant="link" size="sm" onClick={seedDefaults} className="ml-1">
                <Sparkles className="h-3 w-3 mr-1" />
                Seed defaults
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {types.map(type => (
                <div key={type.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                  <Input
                    value={type.icon_url || '🏆'}
                    onChange={e => updateType(type.id, { icon_url: e.target.value })}
                    className="w-14 h-8 text-center text-lg p-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <Input
                      value={type.name}
                      onChange={e => updateType(type.id, { name: e.target.value })}
                      className="h-7 text-sm font-medium"
                    />
                    <Input
                      value={type.description}
                      onChange={e => updateType(type.id, { description: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteType(type.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new type */}
        <div className="space-y-2 border-t pt-4">
          <Label>Add Custom Endorsement Type</Label>
          <div className="flex gap-2">
            <Input value={newIcon} onChange={e => setNewIcon(e.target.value)} className="w-16" placeholder="🏆" />
            <Input value={newName} onChange={e => setNewName(e.target.value)} className="flex-1" placeholder="Name" />
          </div>
          <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description" />
          <Button size="sm" onClick={handleAddType} disabled={!newName.trim()}>
            <Plus className="h-3 w-3 mr-1" />
            Add Type
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
