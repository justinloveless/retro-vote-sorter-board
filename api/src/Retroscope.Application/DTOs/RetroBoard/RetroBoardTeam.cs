namespace Retroscope.Application.DTOs.RetroBoard;

public class RetroBoardTeam
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<RetroBoardTeamMember> Members { get; set; } = new();
}