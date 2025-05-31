
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Settings2, Star } from 'lucide-react';
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
  const { templates, templateColumns, loading, setDefaultTemplate, createTemplate, deleteTemplate } = useBoardTemplates(teamId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [columns, setColumns] = useState([
    { title: 'Good', color: 'bg-green-100 border-green-300', position: 1 },
    { title: 'Bad', color: 'bg-red-100 border-red-300', position: 2 },
    { title: 'Kudos', color: 'bg-blue-100 border-blue-300', position: 3 },
    { title: 'Action Items', color: 'bg-yellow-100 border-yellow-300', position: 4 }
  ]);

  const handleCreateTemplate = async () => {
    if (!templateName.trim() || columns.length === 0) return;

    await createTemplate(templateName, columns);
    setShowCreateDialog(false);
    setTemplateName('');
  };

  const addColumn = () => {
    const newPosition = Math.max(...columns.map(c => c.position), 0) + 1;
    setColumns([...columns, { 
      title: '', 
      color: 'bg-gray-100 border-gray-300', 
      position: newPosition 
    }]);
  };

  const updateColumn = (index: number, field: 'title' | 'color', value: string) => {
    const updatedColumns = [...columns];
    updatedColumns[index] = { ...updatedColumns[index], [field]: value };
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
            Manage default column layouts for new retro boards
          </p>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Board Template</DialogTitle>
              </DialogHeader>
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
                  
                  <div className="space-y-2">
                    {columns.map((column, index) => (
                      <div key={index} className="flex gap-2 items-center">
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
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleCreateTemplate} disabled={!templateName.trim()}>
                    Create Template
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
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
                </div>
              </div>
              
              <div className="flex gap-2">
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
