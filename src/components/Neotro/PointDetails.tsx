import React, { useState, useEffect } from "react";
import { JiraIssueDrawer } from "./JiraIssueDrawer";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink } from "lucide-react";
import { getPointMetadata } from "./pokerPointMetadata";

// Define the component's props interface
interface PointsDetailsProps {
  /**
   * The selected point ID to display details for.
   */
  selectedPoint: number;
  isHandPlayed: boolean;
  /** Winning points (most votes) */
  winningPoints: number;
  ticketNumber: string | null;
  onTicketNumberChange: (value: string) => void;
  onTicketNumberFocus: () => void;
  onTicketNumberBlur: () => void;
  teamId?: string | null;
}

/**
 * A component to display ticket input and winning points for the poker session.
 */
const PointDetails: React.FC<PointsDetailsProps> = ({
  selectedPoint,
  isHandPlayed,
  winningPoints,
  ticketNumber,
  onTicketNumberChange,
  onTicketNumberFocus,
  onTicketNumberBlur,
  teamId,
}) => {
  const [jiraDomain, setJiraDomain] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;

    const fetchJiraDomain = async () => {
      try {
        const { data, error } = await supabase
          .from('jira_integration_settings')
          .select('url')
          .eq('team_id', teamId)
          .single();

        if (error) {
          console.log('Could not fetch Jira domain for team', teamId);
        }

        if (data) {
          setJiraDomain(data.url);
        }
      } catch (e) {
        console.error('Error in fetchJiraDomain:', e);
      }
    };

    fetchJiraDomain();
  }, [teamId]);

  const pointData = getPointMetadata(selectedPoint);

  if (!pointData) {
    return (
      <div className="font-custom bg-[#2d2d2d] text-white p-4 rounded-lg max-w-sm mx-auto text-center">
        <p className="text-xl">Please select a point value.</p>
      </div>
    );
  }

  return (
    <div className="font-custom bg-[#2d2d2d] p-2 space-y-2 rounded-xl">
      {/* Title Section */}
      <div className="text-3xl text-center text-white text-shadow-[3px_3px_rgba(0,0,0,255)] bg-[#0068adff] rounded-lg p-2">
        <div className="relative">
          <input
            type="text"
            value={ticketNumber || ''}
            onChange={(e) => onTicketNumberChange(e.target.value)}
            onFocus={onTicketNumberFocus}
            onBlur={onTicketNumberBlur}
            disabled={isHandPlayed}
            placeholder="RNMT-0000"
            className="bg-transparent text-center w-full focus:outline-none pr-8"
          />
          {jiraDomain && ticketNumber && (
            <a
              href={`${jiraDomain}/browse/${ticketNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:text-gray-300"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>
      {teamId && <JiraIssueDrawer issueIdOrKey={ticketNumber} teamId={teamId} />}
      {/* Winning Points Section */}
      <div className="bg-[#1b2629ff] rounded-lg p-2 text-center text-white flex items-center justify-between">
        <div className="text-xl mr-2">
          Winning
          <br />
          Pts
        </div>
        <div className="bg-[#3c3c3c] rounded-lg p-2 flex items-center justify-center grow">
          <p className="text-2xl whitespace-pre-wrap">
            {isHandPlayed ? winningPoints : "???"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PointDetails;
