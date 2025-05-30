
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Users } from 'lucide-react';

interface TeamSettingsFormProps {
  team: {
    name: string;
    description?: string;
  };
  onSave: (data: { name: string; description: string }) => void;
  onCancel: () => void;
  saving: boolean;
}

export const TeamSettingsForm: React.FC<TeamSettingsFormProps> = ({
  team,
  onSave,
  onCancel,
  saving
}) => {
  const [formData, setFormData] = useState({
    name: team.name || '',
    description: team.description || ''
  });

  const handleSave = () => {
    if (formData.name.trim()) {
      onSave(formData);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="team-name">Team Name</Label>
          <Input
            id="team-name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter team name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="team-description">Description (optional)</Label>
          <Textarea
            id="team-description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter team description"
            rows={3}
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
