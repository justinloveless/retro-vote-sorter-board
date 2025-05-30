
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';

interface PasswordDialogProps {
  onPasswordSubmit: (password: string) => void;
}

export const PasswordDialog: React.FC<PasswordDialogProps> = ({ onPasswordSubmit }) => {
  const [enteredPassword, setEnteredPassword] = useState('');

  const handleSubmit = () => {
    if (enteredPassword) {
      onPasswordSubmit(enteredPassword);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Private Retro Room
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            This retro room is protected. Please enter the password to continue.
          </p>
          <Input
            type="password"
            placeholder="Enter password"
            value={enteredPassword}
            onChange={(e) => setEnteredPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <Button onClick={handleSubmit} className="w-full">
            Join Room
          </Button>
          <p className="text-xs text-gray-500 text-center">
            Demo password: demo123
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
