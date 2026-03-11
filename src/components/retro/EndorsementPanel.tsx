import React, { useState, useEffect, useCallback } from 'react';
import { Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Endorsement } from '@/hooks/useEndorsements';
import { EndorsementType, EndorsementSettings } from '@/hooks/useEndorsementTypes';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface TeamMember {
  user_id: string;
  profiles?: {
    full_name: string | null;
    avatar_url?: string | null;
    nickname?: string | null;
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
  const [open, setOpen] = useState(false);
  const maxEndorsements = settings?.max_endorsements_per_user_per_board ?? 3;
  const remaining = Math.max(0, maxEndorsements - myEndorsementCount);

  const hasEndorsedUser = (toUserId: string) => {
    return endorsements.find(
      e => e.from_user_id === currentUserId && e.to_user_id === toUserId
    );
  };

  const hasEndorsedWithType = (toUserId: string, typeId: string) => {
    return endorsements.some(
      e => e.from_user_id === currentUserId && e.to_user_id === toUserId && e.endorsement_type_id === typeId
    );
  };

  const getEndorsementCountForUser = (userId: string, typeId: string) => {
    return endorsements.filter(e => e.to_user_id === userId && e.endorsement_type_id === typeId).length;
  };

  const otherMembers = members.filter(m => m.user_id !== currentUserId);

  // Keyboard shortcut: "N" key toggles drawer
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'n' || e.key === 'N') {
      // Don't trigger if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      e.preventDefault();
      setOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (endorsementTypes.length === 0) return null;

  return (
    <>
      {/* Floating tab at bottom center */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setOpen(prev => !prev)}
          className="flex items-center gap-2 px-5 py-2 rounded-t-xl bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all text-sm font-medium"
        >
          <Award className="h-4 w-4" />
          Endorse ({remaining})
          <kbd className="ml-1 text-[10px] opacity-70 bg-primary-foreground/20 rounded px-1">N</kbd>
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-background border-t-2 border-primary/30 rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Endorse your teammates</h3>
              <Badge variant="secondary" className="text-xs">
                {remaining} remaining
              </Badge>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Close
            </button>
          </div>

          {/* Member cards grid */}
          <div className="px-6 pb-6">
            {otherMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No other team members to endorse.</p>
            ) : (
              <div className="flex flex-wrap gap-4 justify-center">
                {otherMembers.map(member => {
                  const name = member.profiles?.full_name || member.profiles?.nickname || 'Unknown';
                  return (
                    <div
                      key={member.user_id}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card min-w-[140px] max-w-[180px]"
                    >
                      <UserAvatar
                        avatarUrl={member.profiles?.avatar_url}
                        name={name}
                        className="h-14 w-14 text-lg"
                      />
                      <span className="text-sm font-medium text-center truncate w-full">{name}</span>
                      <div className="flex gap-1.5 mt-1">
                        <TooltipProvider>
                          {endorsementTypes.map(type => {
                            const alreadyGiven = hasEndorsed(member.user_id, type.id);
                            const count = getEndorsementCountForUser(member.user_id, type.id);
                            return (
                              <Tooltip key={type.id}>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={alreadyGiven ? 'default' : 'outline'}
                                    size="icon"
                                    className="h-8 w-8 text-base relative"
                                    disabled={isArchived || (!alreadyGiven && remaining <= 0)}
                                    onClick={() => {
                                      if (!alreadyGiven) {
                                        onGiveEndorsement(member.user_id, type.id);
                                      }
                                    }}
                                  >
                                    <span>{type.icon_url || '🏆'}</span>
                                    {count > 0 && (
                                      <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[9px] h-3.5 w-3.5 flex items-center justify-center font-bold">
                                        {count}
                                      </span>
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
          </div>
        </div>
      </div>
    </>
  );
};
