export interface PointMetadata {
  id: number;
  min: number | string;
  max: number | string;
  comment?: string;
}

export const pokerPointMetadata: PointMetadata[] = [
  { id: -1, min: "NA", max: "NA", comment: "Abstained from voting" },
  { id: 1, min: 0, max: 0.5, comment: "Ok" },
  { id: 2, min: 0.5, max: 1, comment: "Ok" },
  { id: 3, min: 1, max: 2, comment: "Ok" },
  { id: 5, min: 2, max: 4, comment: "Ok" },
  { id: 8, min: 4, max: 7, comment: "Breakdown: Recommended" },
  { id: 13, min: 7, max: 12, comment: "Breakdown enforced, but can enter sprint. Spike recommended" },
  { id: 21, min: 12, max: 24, comment: "Cannot be added into sprint. Has to be broken down" },
];

export function getPointMetadata(pointId: number): PointMetadata | undefined {
  return pokerPointMetadata.find((p) => p.id === pointId);
}

export function formatDuration(metadata: PointMetadata): string {
  if (metadata.min === "NA" || metadata.max === "NA") {
    return "N/A";
  }
  return `${metadata.min} - ${metadata.max} days`;
}
