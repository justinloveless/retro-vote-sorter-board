
import React, { useState, useEffect } from 'react';
import { Plus, Users, Lock, Settings, ThumbsUp, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface RetroItem {
  id: string;
  text: string;
  votes: number;
  author: string;
  columnId: string;
  createdAt: Date;
}

interface Column {
  id: string;
  title: string;
  color: string;
}

interface RetroBoardProps {
  boardId: string;
  isPrivate: boolean;
  onTogglePrivacy: () => void;
}

const defaultColumns: Column[] = [
  { id: 'good', title: 'Good', color: 'bg-green-100 border-green-300' },
  { id: 'bad', title: 'Bad', color: 'bg-red-100 border-red-300' },
  { id: 'kudos', title: 'Kudos', color: 'bg-blue-100 border-blue-300' },
  { id: 'action', title: 'Action Items', color: 'bg-yellow-100 border-yellow-300' }
];

export const RetroBoard: React.FC<RetroBoardProps> = ({ boardId, isPrivate, onTogglePrivacy }) => {
  const [columns, setColumns] = useState<Column[]>(defaultColumns);
  const [items, setItems] = useState<RetroItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [selectedColumn, setSelectedColumn] = useState(columns[0].id);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [userName, setUserName] = useState('Anonymous');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Sort items by votes (highest first) within each column
  const sortedItems = items.sort((a, b) => b.votes - a.votes);

  const addItem = () => {
    if (!newItemText.trim()) return;
    
    const newItem: RetroItem = {
      id: Date.now().toString(),
      text: newItemText,
      votes: 0,
      author: userName,
      columnId: selectedColumn,
      createdAt: new Date()
    };
    
    setItems([...items, newItem]);
    setNewItemText('');
  };

  const addColumn = () => {
    if (!newColumnTitle.trim()) return;
    
    const colors = [
      'bg-purple-100 border-purple-300',
      'bg-orange-100 border-orange-300',
      'bg-pink-100 border-pink-300',
      'bg-indigo-100 border-indigo-300'
    ];
    
    const newColumn: Column = {
      id: Date.now().toString(),
      title: newColumnTitle,
      color: colors[columns.length % colors.length]
    };
    
    setColumns([...columns, newColumn]);
    setNewColumnTitle('');
  };

  const upvoteItem = (itemId: string) => {
    setItems(items.map(item => 
      item.id === itemId ? { ...item, votes: item.votes + 1 } : item
    ));
  };

  const deleteItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const startEdit = (itemId: string, currentText: string) => {
    setEditingItem(itemId);
    setEditText(currentText);
  };

  const saveEdit = () => {
    if (!editText.trim()) return;
    
    setItems(items.map(item => 
      item.id === editingItem ? { ...item, text: editText } : item
    ));
    setEditingItem(null);
    setEditText('');
  };

  const getItemsForColumn = (columnId: string) => {
    return sortedItems.filter(item => item.columnId === columnId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Team Retrospective</h1>
            <p className="text-gray-600">Board ID: {boardId}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-600" />
              <span className="text-sm text-gray-600">{items.length} items</span>
            </div>
            
            <Button 
              variant={isPrivate ? "destructive" : "outline"}
              onClick={onTogglePrivacy}
              className="flex items-center gap-2"
            >
              <Lock className="h-4 w-4" />
              {isPrivate ? 'Private' : 'Public'}
            </Button>
          </div>
        </div>

        {/* User Name Input */}
        <div className="flex items-center gap-4 mb-4">
          <Input
            placeholder="Your name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-48"
          />
        </div>

        {/* Add New Item */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Textarea
                  placeholder="Add a new retro item..."
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  className="resize-none"
                  rows={2}
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <select 
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-white"
                >
                  {columns.map(column => (
                    <option key={column.id} value={column.id}>{column.title}</option>
                  ))}
                </select>
                
                <Button onClick={addItem} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {columns.map(column => (
          <div key={column.id} className="space-y-4">
            <div className={`p-4 rounded-lg border-2 ${column.color}`}>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">{column.title}</h2>
              
              <div className="space-y-3">
                {getItemsForColumn(column.id).map(item => (
                  <Card key={item.id} className="bg-white/90 backdrop-blur-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      {editingItem === item.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="resize-none"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-gray-800 mb-3">{item.text}</p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {item.author}
                              </Badge>
                              <Badge variant={item.votes > 0 ? "default" : "outline"} className="flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" />
                                {item.votes}
                              </Badge>
                            </div>
                            
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => upvoteItem(item.id)}
                                className="h-8 w-8 p-0"
                              >
                                <ThumbsUp className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => startEdit(item.id, item.text)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => deleteItem(item.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Column */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Column
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Column title"
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
            />
            <Button onClick={addColumn} className="w-full">
              Add Column
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
