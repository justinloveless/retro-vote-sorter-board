import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { UserAvatar } from '../../components/ui/UserAvatar.tsx';

interface TeamMember {
    id: string;
    user_id: string;
    profiles?: {
        full_name: string | null;
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

export const MentionSuggestions = forwardRef<MentionSuggestionsRef, MentionSuggestionsProps>(
    ({ query, teamMembers, onSelect }, ref) => {
        const [selectedIndex, setSelectedIndex] = useState(0);
        const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([]);

        useEffect(() => {
            // Filter team members based on query
            const filtered = teamMembers.filter(member => {
                const name = member.profiles?.full_name || 'Unknown User';
                return name.toLowerCase().includes(query.toLowerCase());
            });
            setFilteredMembers(filtered);
            setSelectedIndex(0);
        }, [query, teamMembers]);

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
        }));

        if (filteredMembers.length === 0) {
            return null;
        }

        return (
            <Card className="absolute z-[9999] mt-1 max-h-60 w-64 overflow-y-auto bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600">
                <CardContent className="p-2">
                    {filteredMembers.map((member, index) => (
                        <div
                            key={member.user_id}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${index === selectedIndex
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            onClick={() => onSelect(member)}
                        >
                            <UserAvatar
                                name={member.profiles?.full_name || 'Unknown User'}
                                className="w-6 h-6"
                            />
                            <span className="text-sm font-medium">
                                {member.profiles?.full_name || 'Unknown User'}
                            </span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }
);

MentionSuggestions.displayName = 'MentionSuggestions'; 