import React, { useState } from 'react';
import { Award, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Endorsement } from '@/hooks/useEndorsements';
import { EndorsementType, EndorsementSettings } from '@/hooks/useEndorsementTypes';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface TeamMember {
  user_id: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    nickname: string | null;
  } | null;
}

interface EndorsementPanelProps {
  endorsements: Endorsement[];
  endorsementTypes: EndorsementType[];
  settings: EndorsementSettings | null;
  members: TeamMember[];
  currentUserId: string | undefined;
  myEndorsementCount: number;
  onGiveEndorsement: (toUserId: string, typeId: string) => void;
  isArchived?: boolean;
}

export const EndorsementPanel: React.FC<EndorsementPanelProps> = ({
  endorsements,
  endorsementTypes,
  settings,
  members,
  currentUserId,
  myEndorsementCount,
  onGiveEndorsement,
  isArchived,
}) => {
  const [expanded, setExpanded] = useState(false);
  const maxEndorsements = settings?.max_endorsements_per_user_per_board ?? 3;
  const remaining = Math.max(0, maxEndorsements - myEndorsementCount);

  const hasEndorsed = (toUserId: string, typeId: string) => {
    return endorsements.some(
      e => e.from_user_id === currentUserId && e.to_user_id === toUserId && e.endorsement_type_id === typeId
    );
  };

  const getEndorsementCountForUser = (userId: string, typeId: string) => {
    return endorsements.filter(e => e.to_user_id === userId && e.endorsement_type_id === typeId).length;
  };

  const otherMembers = members.filter(m => m.user_id !== currentUserId);

  if (endorsementTypes.length === 0) return null;

  return (
    <Card className="mb-4 border-primary/20">
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Endorsements</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {remaining} left
            </Badge>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 px-4 pb-4">
          {otherMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other team members to endorse.</p>
          ) : (
            <div className="space-y-3">
              {otherMembers.map(member => {
                const name = member.profiles?.full_name || member.profiles?.nickname || 'Unknown';
                return (
                  <div key={member.user_id} className="flex items-center gap-3">
                    <UserAvatar
                      avatarUrl={member.profiles?.avatar_url}
                      name={name}
                      className="h-7 w-7"
                    />
                    <span className="text-sm font-medium flex-1 truncate">{name}</span>
                    <div className="flex gap-1">
                      <TooltipProvider>
                        {endorsementTypes.map(type => {
                          const alreadyGiven = hasEndorsed(member.user_id, type.id);
                          const count = getEndorsementCountForUser(member.user_id, type.id);
                          return (
                            <Tooltip key={type.id}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={alreadyGiven ? 'default' : 'outline'}
                                  size="sm"
                                  className="h-7 px-2 text-xs relative"
                                  disabled={isArchived || (!alreadyGiven && remaining <= 0)}
                                  onClick={() => {
                                    if (!alreadyGiven) {
                                      onGiveEndorsement(member.user_id, type.id);
                                    }
                                  }}
                                >
                                  <span>{type.icon_url || '🏆'}</span>
                                  {count > 0 && (
                                    <span className="ml-0.5 text-[10px]">{count}</span>
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">{type.name}</p>
                                <p className="text-xs text-muted-foreground">{type.description}</p>
                                {alreadyGiven && <p className="text-xs text-primary mt-1">✓ You endorsed this</p>}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </TooltipProvider>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
