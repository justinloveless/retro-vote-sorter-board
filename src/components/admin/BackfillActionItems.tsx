import React, { useState } from 'react';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { Button } from '../../components/ui/button.tsx';
import { supabase } from '../../integrations/supabase/client.ts';

export const BackfillActionItems: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runBackfill = async () => {
    setRunning(true);
    setResult(null);
    try {
      // Fetch all boards with their team and columns
      const { data: boards, error: boardsError } = await supabase
        .from('retro_boards')
        .select('id, team_id');
      if (boardsError) throw boardsError;

      let createdCount = 0;

      for (const board of boards || []) {
        if (!board.team_id) continue;
        // Find action items column for this board
        const { data: columns, error: colsError } = await supabase
          .from('retro_columns')
          .select('id, is_action_items')
          .eq('board_id', board.id);
        if (colsError) throw colsError;
        const actionColumn = (columns || []).find(c => c.is_action_items === true);
        if (!actionColumn) continue;

        // Get items in that column
        const { data: items, error: itemsError } = await supabase
          .from('retro_items')
          .select('id, text')
          .eq('board_id', board.id)
          .eq('column_id', actionColumn.id);
        if (itemsError) throw itemsError;

        for (const item of items || []) {
          // Upsert into team_action_items if not exists (protected by unique index)
          const { error: insError } = await supabase
            .from('team_action_items')
            .insert([{ team_id: board.team_id, text: item.text, source_board_id: board.id, source_item_id: item.id }], { onConflict: 'source_item_id' });
          if (!insError) {
            createdCount += 1;
          }
        }
      }

      setResult(`Backfill complete. Created or ensured ${createdCount} action item records.`);
    } catch (e: any) {
      console.error('Backfill error', e);
      setResult(`Error: ${e.message || e.toString()}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Backfill team action items by scanning all boards for items in the official Action Items columns.
        </div>
        <Button onClick={runBackfill} disabled={running}>
          {running ? 'Running…' : 'Run Action Items Backfill'}
        </Button>
        {result && (
          <div className="text-sm text-gray-700 dark:text-gray-300">{result}</div>
        )}
      </CardContent>
    </Card>
  );
};


