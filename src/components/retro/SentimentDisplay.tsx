import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';

interface SentimentDisplayProps {
  items: any[];
}

interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export const SentimentDisplay: React.FC<SentimentDisplayProps> = ({ items }) => {
  const [sentiment, setSentiment] = useState<SentimentResult>({ sentiment: 'neutral', confidence: 0 });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isFeatureEnabled } = useFeatureFlags();

  const isSentimentAnalysisEnabled = isFeatureEnabled('sentiment_analysis');

  console.log('SentimentDisplay: isSentimentAnalysisEnabled', isSentimentAnalysisEnabled);

  const analyzeSentiment = async () => {
    if (items.length === 0) {
      setSentiment({ sentiment: 'neutral', confidence: 0 });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-board-sentiment', {
        body: { boardItems: items }
      });

      if (error) throw error;

      setSentiment(data);
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      toast({
        title: "Error analyzing sentiment",
        description: "Unable to analyze board sentiment at this time.",
        variant: "destructive",
      });
      setSentiment({ sentiment: 'neutral', confidence: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      analyzeSentiment();
    }, 1000); // Debounce analysis by 1 second

    return () => clearTimeout(timeoutId);
  }, [items]);

  if (!isSentimentAnalysisEnabled) {
    return null;
  }

  const getSentimentEmoji = () => {
    if (loading) return '🤔';

    switch (sentiment.sentiment) {
      case 'positive':
        return sentiment.confidence > 0.7 ? '😊' : '🙂';
      case 'negative':
        return sentiment.confidence > 0.7 ? '😞' : '😐';
      default:
        return '😐';
    }
  };

  const getSentimentLabel = () => {
    if (loading) return 'Analyzing...';

    const confidenceText = sentiment.confidence > 0.5
      ? ` (${Math.round(sentiment.confidence * 100)}% confidence)`
      : '';

    return `${sentiment.sentiment.charAt(0).toUpperCase() + sentiment.sentiment.slice(1)} Sentiment${confidenceText}`;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/50 dark:bg-gray-800/50 rounded-lg border">
      <span className="text-2xl" title={getSentimentLabel()}>
        {getSentimentEmoji()}
      </span>
      <div className="text-sm">
        <div className="font-medium text-gray-700 dark:text-gray-300">
          Board Mood
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {loading ? 'Analyzing...' : sentiment.sentiment}
        </div>
      </div>
    </div>
  );
};
