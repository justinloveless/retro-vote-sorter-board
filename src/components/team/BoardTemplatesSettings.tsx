import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Settings2, Star, Edit2 } from 'lucide-react';
import { useBoardTemplates } from '@/hooks/useBoardTemplates';

interface BoardTemplatesSettingsProps {
  teamId: string;
}

const PRESET_COLORS = [
  { name: 'Green', value: 'bg-green-100 border-green-300' },
  { name: 'Red', value: 'bg-red-100 border-red-300' },
  { name: 'Blue', value: 'bg-blue-100 border-blue-300' },
  { name: 'Yellow', value: 'bg-yellow-100 border-yellow-300' },
  { name: 'Purple', value: 'bg-purple-100 border-purple-300' },
  { name: 'Orange', value: 'bg-orange-100 border-orange-300' },
  { name: 'Pink', value: 'bg-pink-100 border-pink-300' },
  { name: 'Teal', value: 'bg-teal-100 border-teal-300' },
];

export const BoardTemplatesSettings: React.FC<BoardTemplatesSettingsProps> = ({ teamId }) => {
  const { templates, templateColumns, loading, setDefaultTemplate, createTemplate, updateTemplate, deleteTemplate } = useBoardTemplates(teamId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [columns, setColumns] = useState([
    { title: 'Good', color: 'bg-green-100 border-green-300', position: 1, is_action_items: false },
    { title: 'Bad', color: 'bg-red-100 border-red-300', position: 2, is_action_items: false },
    { title: 'Kudos', color: 'bg-blue-100 border-blue-300', position: 3, is_action_items: false },
    { title: 'Action Items', color: 'bg-yellow-100 border-yellow-300', position: 4, is_action_items: true }
  ]);
  const [boardConfig, setBoardConfig] = useState({
    allow_anonymous: true,
    voting_enabled: true,
    max_votes_per_user: null as number | null,
    show_author_names: true,
    retro_stages_enabled: false,
    enforce_stage_readiness: false
  });

  const handleCreateTemplate = async () => {
    if (!templateName.trim() || columns.length === 0) return;

    await createTemplate(templateName, columns, boardConfig);
    setShowCreateDialog(false);
    resetForm();
  };

  const handleEditTemplate = async () => {
    if (!templateName.trim() || columns.length === 0 || !editingTemplate) return;

    await updateTemplate(editingTemplate, templateName, columns, boardConfig);
    setShowEditDialog(false);
    setEditingTemplate(null);
    resetForm();
  };

  const resetForm = () => {
    setTemplateName('');
    setColumns([
      { title: 'Good', color: 'bg-green-100 border-green-300', position: 1, is_action_items: false },
      { title: 'Bad', color: 'bg-red-100 border-red-300', position: 2, is_action_items: false },
      { title: 'Kudos', color: 'bg-blue-100 border-blue-300', position: 3, is_action_items: false },
      { title: 'Action Items', color: 'bg-yellow-100 border-yellow-300', position: 4, is_action_items: true }
    ]);
    setBoardConfig({
      allow_anonymous: true,
      voting_enabled: true,
      max_votes_per_user: null,
      show_author_names: true,
      retro_stages_enabled: false
    });
  };

  const openEditDialog = (template: any) => {
    const columns = templateColumns[template.id] || [];
    
    setEditingTemplate(template.id);
    setTemplateName(template.name);
    setColumns(columns.map(col => ({
      title: col.title,
      color: col.color,
      position: col.position,
      is_action_items: col.is_action_items || false
    })));
    setBoardConfig({
      allow_anonymous: template.allow_anonymous,
      voting_enabled: template.voting_enabled,
      max_votes_per_user: template.max_votes_per_user,
      show_author_names: template.show_author_names,
      retro_stages_enabled: template.retro_stages_enabled || false
    });
    setShowEditDialog(true);
  };

  const addColumn = () => {
    const newPosition = Math.max(...columns.map(c => c.position), 0) + 1;
    setColumns([...columns, { 
      title: '', 
      color: 'bg-gray-100 border-gray-300', 
      position: newPosition,
      is_action_items: false
    }]);
  };

  const updateColumn = (index: number, field: 'title' | 'color', value: string) => {
    const updatedColumns = [...columns];
    updatedColumns[index] = { ...updatedColumns[index], [field]: value };
    setColumns(updatedColumns);
  };

  const updateColumnActionItems = (index: number, isActionItems: boolean) => {
    const updatedColumns = [...columns];
    // First, set all columns to false
    updatedColumns.forEach(col => col.is_action_items = false);
    // Then set the selected column to the desired value
    if (isActionItems) {
      updatedColumns[index].is_action_items = true;
    }
    setColumns(updatedColumns);
  };

  const removeColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const getColorName = (colorValue: string) => {
    return PRESET_COLORS.find(c => c.value === colorValue)?.name || 'Gray';
  };

  if (loading) {
    return <div>Loading templates...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Board Templates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Manage default column layouts and board settings for new retro boards
          </p>
          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Board Template</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Template Info and Columns */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Template Name</label>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Sprint Retrospective"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium">Columns</label>
                      <Button type="button" size="sm" variant="outline" onClick={addColumn}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Column
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {columns.map((column, index) => (
                        <div key={index} className="space-y-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                          <div className="flex gap-2 items-center">
                            <Input
                              value={column.title}
                              onChange={(e) => updateColumn(index, 'title', e.target.value)}
                              placeholder="Column title"
                              className="flex-1"
                            />
                            <Select 
                              value={column.color} 
                              onValueChange={(value) => updateColumn(index, 'color', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PRESET_COLORS.map(color => (
                                  <SelectItem key={color.value} value={color.value}>
                                    {color.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {columns.length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeColumn(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-xs text-gray-600 dark:text-gray-400">
                                Action Items Column
                              </Label>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Special permissions during discussion stage
                              </p>
                            </div>
                            <Switch
                              checked={column.is_action_items || false}
                              onCheckedChange={(checked) => updateColumnActionItems(index, checked)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column - Board Settings */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-3">Board Settings</label>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="allow-anonymous" className="text-sm">Allow Anonymous Posts</Label>
                        <Switch
                          id="allow-anonymous"
                          checked={boardConfig.allow_anonymous}
                          onCheckedChange={(checked) => setBoardConfig(prev => ({ ...prev, allow_anonymous: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-author-names" className="text-sm">Show Author Names</Label>
                        <Switch
                          id="show-author-names"
                          checked={boardConfig.show_author_names}
                          onCheckedChange={(checked) => setBoardConfig(prev => ({ ...prev, show_author_names: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="voting-enabled" className="text-sm">Enable Voting</Label>
                        <Switch
                          id="voting-enabled"
                          checked={boardConfig.voting_enabled}
                          onCheckedChange={(checked) => setBoardConfig(prev => ({ ...prev, voting_enabled: checked }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max-votes" className="text-sm">Max Votes Per User (optional)</Label>
                        <Input
                          id="max-votes"
                          type="number"
                          placeholder="Unlimited"
                          value={boardConfig.max_votes_per_user || ''}
                          onChange={(e) => setBoardConfig(prev => ({ 
                            ...prev, 
                            max_votes_per_user: e.target.value ? parseInt(e.target.value) : null 
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="retro-stages-enabled" className="text-sm">Enable Structured Retro Stages</Label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Guide retrospectives through thinking, voting, discussing, and closing stages
                          </p>
                        </div>
                        <Switch
                          id="retro-stages-enabled"
                          checked={boardConfig.retro_stages_enabled}
                          onCheckedChange={(checked) => setBoardConfig(prev => ({ ...prev, retro_stages_enabled: checked }))}
                        />
                      </div>

                      {boardConfig.retro_stages_enabled && (
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="space-y-0.5">
                            <Label htmlFor="enforce-stage-readiness" className="text-sm">Enforce Stage Readiness</Label>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Require all users to be ready before allowing admins to advance stages
                            </p>
                          </div>
                          <Switch
                            id="enforce-stage-readiness"
                            checked={boardConfig.enforce_stage_readiness}
                            onCheckedChange={(checked) => setBoardConfig(prev => ({ ...prev, enforce_stage_readiness: checked }))}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
                
              <div className="flex gap-2 mt-6">
                <Button onClick={handleCreateTemplate} disabled={!templateName.trim()}>
                  Create Template
                </Button>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Template Dialog */}
          <Dialog open={showEditDialog} onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) {
              setEditingTemplate(null);
              resetForm();
            }
          }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Template</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-template-name">Template Name</Label>
                  <Input
                    id="edit-template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Sprint Retrospective"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Columns */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-3">Columns</label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={addColumn}
                        className="mb-3"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Column
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {columns.map((column, index) => (
                        <div key={index} className="space-y-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                          <div className="flex gap-2 items-center">
                            <Input
                              value={column.title}
                              onChange={(e) => updateColumn(index, 'title', e.target.value)}
                              placeholder="Column title"
                              className="flex-1"
                            />
                            <Select 
                              value={column.color} 
                              onValueChange={(value) => updateColumn(index, 'color', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PRESET_COLORS.map(color => (
                                  <SelectItem key={color.value} value={color.value}>
                                    {color.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {columns.length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeColumn(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-xs text-gray-600 dark:text-gray-400">
                                Action Items Column
                              </Label>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Special permissions during discussion stage
                              </p>
                            </div>
                            <Switch
                              checked={column.is_action_items || false}
                              onCheckedChange={(checked) => updateColumnActionItems(index, checked)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column - Board Settings */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-3">Board Settings</label>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="edit-allow-anonymous" className="text-sm">Allow Anonymous Posts</Label>
                          <Switch
                            id="edit-allow-anonymous"
                            checked={boardConfig.allow_anonymous}
                            onCheckedChange={(checked) => setBoardConfig(prev => ({ ...prev, allow_anonymous: checked }))}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="edit-show-author-names" className="text-sm">Show Author Names</Label>
                          <Switch
                            id="edit-show-author-names"
                            checked={boardConfig.show_author_names}
                            onCheckedChange={(checked) => setBoardConfig(prev => ({ ...prev, show_author_names: checked }))}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="edit-voting-enabled" className="text-sm">Enable Voting</Label>
                          <Switch
                            id="edit-voting-enabled"
                            checked={boardConfig.voting_enabled}
                            onCheckedChange={(checked) => setBoardConfig(prev => ({ ...prev, voting_enabled: checked }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="edit-max-votes" className="text-sm">Max Votes Per User (optional)</Label>
                          <Input
                            id="edit-max-votes"
                            type="number"
                            placeholder="Unlimited"
                            value={boardConfig.max_votes_per_user || ''}
                            onChange={(e) => setBoardConfig(prev => ({ 
                              ...prev, 
                              max_votes_per_user: e.target.value ? parseInt(e.target.value) : null 
                            }))}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="edit-retro-stages-enabled" className="text-sm">Enable Structured Retro Stages</Label>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Guide retrospectives through thinking, voting, discussing, and closing stages
                            </p>
                          </div>
                          <Switch
                            id="edit-retro-stages-enabled"
                            checked={boardConfig.retro_stages_enabled}
                            onCheckedChange={(checked) => setBoardConfig(prev => ({ ...prev, retro_stages_enabled: checked }))}
                          />
                        </div>

                        {boardConfig.retro_stages_enabled && (
                          <div className="flex items-center justify-between pt-2 border-t">
                            <div className="space-y-0.5">
                              <Label htmlFor="edit-enforce-stage-readiness" className="text-sm">Enforce Stage Readiness</Label>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Require all users to be ready before allowing admins to advance stages
                              </p>
                            </div>
                            <Switch
                              id="edit-enforce-stage-readiness"
                              checked={boardConfig.enforce_stage_readiness}
                              onCheckedChange={(checked) => setBoardConfig(prev => ({ ...prev, enforce_stage_readiness: checked }))}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                  
                <div className="flex gap-2 mt-6">
                  <Button onClick={handleEditTemplate} disabled={!templateName.trim()}>
                    Update Template
                  </Button>
                  <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {templates.map((template) => (
            <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template.name}</span>
                    {template.is_default && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {templateColumns[template.id]?.length || 0} columns:{' '}
                    {templateColumns[template.id]?.map(col => col.title).join(', ')}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 flex gap-3 flex-wrap">
                    <span>Anonymous: {template.allow_anonymous ? 'Yes' : 'No'}</span>
                    <span>Voting: {template.voting_enabled ? 'Yes' : 'No'}</span>
                    <span>Authors: {template.show_author_names ? 'Visible' : 'Hidden'}</span>
                    <span>Retro Stages: {template.retro_stages_enabled ? 'Yes' : 'No'}</span>
                    {template.retro_stages_enabled && (
                      <span>Enforce Readiness: {template.enforce_stage_readiness ? 'Yes' : 'No'}</span>
                    )}
                    {template.max_votes_per_user && <span>Max votes: {template.max_votes_per_user}</span>}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEditDialog(template)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                {!template.is_default && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDefaultTemplate(template.id)}
                  >
                    Set as Default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteTemplate(template.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          
          {templates.length === 0 && (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              No templates created yet. Create your first template to get started.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
