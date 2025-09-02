import React, { useState, useEffect } from "react";
import { JiraIssueDrawer } from "./JiraIssueDrawer.tsx";
import { supabase } from '../../integrations/supabase/client.ts';
import { ExternalLink } from "lucide-react";

// Data for point details
const detailsData = [
  { id: -1, Min: "NA", Max: "NA", Comment: "Abstained\nfrom voting" },
  { id: 1, Min: 0, Max: 0.5, Comment: "Ok" },
  { id: 2, Min: 0.5, Max: 1, Comment: "Ok" },
  { id: 3, Min: 1, Max: 2, Comment: "Ok" },
  { id: 5, Min: 2, Max: 4, Comment: "Ok" },
  { id: 8, Min: 4, Max: 7, Comment: "Breakdown: Recommended" },
  {
    id: 13,
    Min: 7,
    Max: 12,
    Comment: "Breakdown enforced,\nbut can enter sprint.\nSpike reccomended",
  },
  {
    id: 21,
    Min: 12,
    Max: 24,
    Comment: "Cannot be added into sprint.\nHas to be broken down",
  },
];

// Define the component's props interface
interface PointsDetailsProps {
  /**
   * The selected point ID to display details for.
   */
  selectedPoint: number;
  isHandPlayed: boolean;
  averagePoints: number;
  ticketNumber: string | null;
  onTicketNumberChange: (value: string) => void;
  onTicketNumberFocus: () => void;
  onTicketNumberBlur: () => void;
  teamId?: string | null;
}

/**
 * A component to display the duration and comment for a selected point value.
 */
const PointDetails: React.FC<PointsDetailsProps> = ({
  selectedPoint,
  isHandPlayed,
  averagePoints,
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

  // Find the details for the currently selected point
  const pointData = detailsData.find((detail) => detail.id === selectedPoint);

  // Render a fallback UI if no matching point is found
  if (!pointData) {
    return (
      <div className="font-custom bg-[#2d2d2d] text-white p-4 rounded-lg max-w-sm mx-auto text-center">
        <p className="text-xl">Please select a point value.</p>
      </div>
    );
  }

  const { Min, Max, Comment } = pointData;

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
      {/* Team Points Section */}
      <div className="bg-[#1b2629ff] rounded-lg p-2 text-center text-white flex items-center justify-between">
        <div className="text-xl mr-2">
          Avg.
          <br />
          Pts
        </div>
        <div className="bg-[#3c3c3c] rounded-lg p-2 flex items-center justify-center grow">
          <p className="text-2xl whitespace-pre-wrap">
            {isHandPlayed ? averagePoints.toFixed(2) : "???"}
          </p>
        </div>
      </div>
      {/* Duration Section */}
      <div className="bg-[#1b2629ff] rounded-lg p-2 text-center text-white">
        <div className="mb-2 text-3xl text-shadow-[3px_3px_rgba(0,0,0,255)]">
          Duration
        </div>
        <div className="flex justify-center items-center space-x-2">
          {/* Min Box */}
          <div className="text-center">
            <div className="bg-[#007bff] w-24 h-16 flex items-center justify-center rounded-lg">
              <span className="text-4xl text-shadow-[3px_3px_rgba(0,93,172,255)]">
                {Min}
              </span>
            </div>
            <p className="mt-1 text-base">Min</p>
          </div>
          {/* Max Box */}
          <div className="text-center">
            <div className="bg-[#ff4c40ff] w-24 h-16 flex items-center justify-center rounded-lg">
              <span className="text-4xl text-shadow-[3px_3px_rgba(170,44,36,255)]">
                {Max}
              </span>
            </div>
            <p className="mt-1 text-base">Max</p>
          </div>
        </div>
      </div>

      {/* Comment Section */}
      <div className="bg-[#1b2629ff] rounded-lg p-2 text-center text-white">
        <div className="text-xl mb-1">Comment</div>
        <div className="bg-[#3c3c3c] rounded-lg p-2 min-h-[80px] flex items-center justify-center">
          <p className="text-lg whitespace-pre-wrap">{Comment}</p>
        </div>
      </div>
    </div>
  );
};

export default PointDetails;
