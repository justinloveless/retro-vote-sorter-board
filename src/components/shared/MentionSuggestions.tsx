import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { dedupeTeamMembersByUserId, memberMatchesMentionQuery } from '@/lib/mentionMatching';

interface TeamMember {
    id: string;
    user_id: string;
    profiles?: {
        full_name: string | null;
        nickname?: string | null;
        avatar_url?: string | null;
    } | null;
}

interface MentionSuggestionsProps {
    query: string;
    teamMembers: TeamMember[];
    onSelect: (member: TeamMember) => void;
}

export interface MentionSuggestionsRef {
    onKeyDown: (event: KeyboardEvent) => boolean;
}

const displayNameFor = (member: TeamMember): string => {
    return member.profiles?.full_name?.trim() || member.profiles?.nickname?.trim() || 'Unknown User';
};

/** When multiple people share a full name, surface nickname (or a short id) to tell them apart. */
const disambiguationLabel = (member: TeamMember, duplicateNames: Set<string>): string | null => {
    const fullName = member.profiles?.full_name?.trim() || '';
    const nickname = member.profiles?.nickname?.trim() || '';
    if (nickname) return nickname;
    if (fullName && duplicateNames.has(fullName.toLowerCase())) {
        return member.user_id.slice(0, 8);
    }
    return null;
};

export const MentionSuggestions = forwardRef<MentionSuggestionsRef, MentionSuggestionsProps>(
    ({ query, teamMembers, onSelect }, ref) => {
        const [selectedIndex, setSelectedIndex] = useState(0);

        const filteredMembers = useMemo(() => {
            const unique = dedupeTeamMembersByUserId(teamMembers);
            return unique
                .filter(member => memberMatchesMentionQuery(member, query))
                .sort((a, b) => displayNameFor(a).localeCompare(displayNameFor(b)));
        }, [query, teamMembers]);

        const duplicateNames = useMemo(() => {
            const counts = new Map<string, number>();
            for (const member of filteredMembers) {
                const key = (member.profiles?.full_name || '').trim().toLowerCase();
                if (!key) continue;
                counts.set(key, (counts.get(key) || 0) + 1);
            }
            return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name));
        }, [filteredMembers]);

        useEffect(() => {
            setSelectedIndex(0);
        }, [filteredMembers]);

        useImperativeHandle(ref, () => ({
            onKeyDown: (event: KeyboardEvent) => {
                if (filteredMembers.length === 0) return false;

                switch (event.key) {
                    case 'ArrowUp':
                        event.preventDefault();
                        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredMembers.length - 1));
                        return true;
                    case 'ArrowDown':
                        event.preventDefault();
                        setSelectedIndex(prev => (prev < filteredMembers.length - 1 ? prev + 1 : 0));
                        return true;
                    case 'Tab':
                        event.preventDefault();
                        setSelectedIndex(prev => (prev < filteredMembers.length - 1 ? prev + 1 : 0));
                        return true;
                    case 'Enter':
                        event.preventDefault();
                        if (filteredMembers[selectedIndex]) {
                            onSelect(filteredMembers[selectedIndex]);
                        }
                        return true;
                    case 'Escape':
                        event.preventDefault();
                        return true;
                    default:
                        return false;
                }
            }
        }), [filteredMembers, selectedIndex, onSelect]);

        if (filteredMembers.length === 0) {
            return null;
        }

        return (
            <Card className="absolute z-[9999] mt-1 max-h-60 w-64 overflow-y-auto bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600">
                <CardContent className="p-2">
                    {filteredMembers.map((member, index) => {
                        const name = displayNameFor(member);
                        const secondary = disambiguationLabel(member, duplicateNames);
                        return (
                            <div
                                key={member.user_id}
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${index === selectedIndex
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                onClick={() => onSelect(member)}
                            >
                                <UserAvatar
                                    name={name}
                                    avatarUrl={member.profiles?.avatar_url || undefined}
                                    className="w-6 h-6"
                                />
                                <span className="text-sm font-medium truncate">
                                    {name}
                                    {secondary && secondary !== name && (
                                        <span className="text-muted-foreground ml-1 font-normal">({secondary})</span>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        );
    }
);

MentionSuggestions.displayName = 'MentionSuggestions';
