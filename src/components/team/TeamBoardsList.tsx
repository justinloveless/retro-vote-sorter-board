
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Plus, Eye, EyeOff, Lock } from 'lucide-react';

interface TeamBoard {
  id: string;
  room_id: string;
  title: string;
  is_private: boolean;
  password_hash: string | null;
  created_at: string;
}

interface TeamBoardsListProps {
  boards: TeamBoard[];
  loading: boolean;
  onCreateBoard: () => void;
}

export const TeamBoardsList: React.FC<TeamBoardsListProps> = ({ 
  boards, 
  loading, 
  onCreateBoard 
}) => {
  const navigate = useNavigate();
  const [showPasswords, setShowPasswords] = useState<{[key: string]: boolean}>({});

  const togglePasswordVisibility = (boardId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [boardId]: !prev[boardId]
    }));
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">Loading boards...</div>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No retro boards yet</h3>
          <p className="text-gray-600 mb-4">Create your first retro board for this team.</p>
          <Button onClick={onCreateBoard}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Board
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {boards.map((board) => (
        <Card key={board.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="truncate">{board.title}</span>
              <div className="flex items-center gap-2">
                {board.is_private && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Private
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePasswordVisibility(board.id)}
                      className="h-6 w-6 p-0"
                    >
                      {showPasswords[board.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-gray-500 mb-4">
              <Calendar className="h-4 w-4 mr-1" />
              {new Date(board.created_at).toLocaleDateString()}
            </div>
            {board.is_private && board.password_hash && (
              <div className="mb-4 p-2 bg-gray-50 rounded text-sm">
                <div className="flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  <span className="font-medium">Password:</span>
                  <span className="font-mono">
                    {showPasswords[board.id] ? board.password_hash : '••••••'}
                  </span>
                </div>
              </div>
            )}
            <Button
              onClick={() => navigate(`/retro/${board.room_id}`)}
              className="w-full"
            >
              Open Board
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
