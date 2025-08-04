import React from 'react';
import { CheckCircle, Circle, Users, Vote, MessageSquare, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RetroStage } from '@/hooks/useRetroBoard';

interface StageInfo {
  key: RetroStage;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface RetroStageStepperProps {
  currentStage: RetroStage;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const stages: StageInfo[] = [
  {
    key: 'thinking',
    label: 'Thinking',
    description: 'Add retro items and thoughts',
    icon: <Users className="h-4 w-4" />,
  },
  {
    key: 'voting',
    label: 'Voting',
    description: 'Vote on the most important items',
    icon: <Vote className="h-4 w-4" />,
  },
  {
    key: 'discussing',
    label: 'Discussing',
    description: 'Discuss items and create action plans',
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    key: 'closed',
    label: 'Closed',
    description: 'Retrospective complete',
    icon: <Archive className="h-4 w-4" />,
  },
];

export const RetroStageStepper: React.FC<RetroStageStepperProps> = ({
  currentStage,
  className,
  size = 'md'
}) => {
  const currentStageIndex = stages.findIndex(stage => stage.key === currentStage);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'gap-2',
          step: 'h-8 w-8',
          icon: 'h-3 w-3',
          text: 'text-xs',
          line: 'h-0.5',
        };
      case 'lg':
        return {
          container: 'gap-6',
          step: 'h-12 w-12',
          icon: 'h-5 w-5',
          text: 'text-base',
          line: 'h-1',
        };
      default: // md
        return {
          container: 'gap-4',
          step: 'h-10 w-10',
          icon: 'h-4 w-4',
          text: 'text-sm',
          line: 'h-0.5',
        };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <div className={cn('flex items-center justify-center', sizeClasses.container, className)}>
      {stages.map((stage, index) => {
        const isCompleted = index < currentStageIndex;
        const isCurrent = index === currentStageIndex;
        const isUpcoming = index > currentStageIndex;

        return (
          <React.Fragment key={stage.key}>
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'rounded-full border-2 flex items-center justify-center transition-all duration-200',
                  sizeClasses.step,
                  {
                    // Completed state
                    'bg-green-500 border-green-500 text-white': isCompleted,
                    // Current state
                    'bg-blue-500 border-blue-500 text-white shadow-md': isCurrent,
                    // Upcoming state
                    'bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600': isUpcoming,
                  }
                )}
              >
                {isCompleted ? (
                  <CheckCircle className={sizeClasses.icon} />
                ) : isCurrent ? (
                  <div className={cn('animate-pulse', sizeClasses.icon)}>
                    {stage.icon}
                  </div>
                ) : (
                  <Circle className={sizeClasses.icon} />
                )}
              </div>
              
              {/* Step Label */}
              <div className="mt-2 text-center">
                <div
                  className={cn(
                    'font-medium transition-colors duration-200',
                    sizeClasses.text,
                    {
                      'text-green-600 dark:text-green-400': isCompleted,
                      'text-blue-600 dark:text-blue-400': isCurrent,
                      'text-gray-500 dark:text-gray-400': isUpcoming,
                    }
                  )}
                >
                  {stage.label}
                </div>
                
                {size !== 'sm' && (
                  <div
                    className={cn(
                      'text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-20 leading-tight',
                      {
                        'text-green-500 dark:text-green-400': isCompleted,
                        'text-blue-500 dark:text-blue-400': isCurrent,
                      }
                    )}
                  >
                    {stage.description}
                  </div>
                )}
              </div>
            </div>

            {/* Connection Line */}
            {index < stages.length - 1 && (
              <div
                className={cn(
                  'flex-1 transition-colors duration-200',
                  sizeClasses.line,
                  {
                    'bg-green-500': index < currentStageIndex,
                    'bg-blue-500': index === currentStageIndex - 1,
                    'bg-gray-300 dark:bg-gray-600': index >= currentStageIndex,
                  }
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default RetroStageStepper;