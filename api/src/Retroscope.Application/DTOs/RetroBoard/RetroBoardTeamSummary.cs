namespace Retroscope.Application.DTOs.RetroBoard;

public class RetroBoardTeamSummary
{
    public RetroBoardItem Board { get; set; } = new();
    public RetroBoardTeam? Team { get; set; }
}