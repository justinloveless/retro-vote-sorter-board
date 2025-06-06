import React from "react";

// Data for point details
const detailsData = [
  { id: -1, Min: "-1", Max: "-1", Comment: "Abstained\nfrom voting" },
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
}

/**
 * A component to display the duration and comment for a selected point value.
 */
const PointDetails: React.FC<PointsDetailsProps> = ({
  selectedPoint,
  isHandPlayed,
}) => {
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
    <div className="font-custom bg-[#2d2d2d] p-2 space-y-2 rounded-xl pt-[30px]">
      {/* Title Section */}
      <div className="text-5xl text-center text-white text-shadow-[5px_5px_rgba(0,0,0,255)] mb-4 bg-[#0068adff] rounded-lg p-4">
        RNMT-0000
      </div>
      <div className="text-5xl text-center text-white mb-4 bg-[#0e435fff] rounded-lg p-4 pt-10 pb-10">
        Title of Ticket
      </div>
      {/* Team Points Section */}
      <div className="bg-[#1b2629ff] rounded-lg p-4 text-center text-white flex item-center space-between">
        <div className="text-3xl mb-2 mr-2">
          Avg.
          <br />
          Pts
        </div>
        <div className="bg-[#3c3c3c] rounded-lg p-4 flex items-center justify-center grow">
          <p className="text-4xl whitespace-pre-wrap">
            {isHandPlayed ? "7.25" : "???"}
          </p>
        </div>
      </div>
      {/* Duration Section */}
      <div className="bg-[#1b2629ff] rounded-lg p-4 text-center text-white">
        <div className="mb-4 text-5xl text-shadow-[5px_5px_rgba(0,0,0,255)]">
          Duration
        </div>
        <div className="flex justify-center items-start space-x-3">
          {/* Min Box */}
          <div className="text-center">
            <div className="bg-[#007bff] w-28 h-20 flex items-center justify-center rounded-lg">
              <span className="text-6xl text-shadow-[5px_5px_rgba(0,93,172,255)]">
                {Min}
              </span>
            </div>
            <p className="mt-2 text-xl">Min</p>
          </div>
          {/* Max Box */}
          <div className="text-center">
            <div className="bg-[#ff4c40ff] w-28 h-20 flex items-center justify-center rounded-lg">
              <span className="text-6xl text-shadow-[4px_4px_rgba(170,44,36,255)]">
                {Max}
              </span>
            </div>
            <p className="mt-2 text-xl">Max</p>
          </div>
        </div>
      </div>

      {/* Comment Section */}
      <div className="bg-[#1b2629ff] rounded-lg p-4 text-center text-white">
        <div className="text-3xl mb-2">Comment</div>
        <div className="bg-[#3c3c3c] rounded-lg p-4 min-h-[120px] flex items-center justify-center">
          <p className="text-2xl whitespace-pre-wrap">{Comment}</p>
        </div>
      </div>
    </div>
  );
};

export default PointDetails;
