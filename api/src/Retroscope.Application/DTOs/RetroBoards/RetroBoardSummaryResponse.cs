namespace Retroscope.Application.DTOs.RetroBoards;

public sealed class RetroBoardSummaryResponse
{
    public RetroBoardItem Board { get; set; } = new();
    public TeamInfo? Team { get; set; }
}

public sealed class TeamInfo
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<TeamMemberInfo> Members { get; set; } = new();
}

public sealed class TeamMemberInfo
{
    public string UserId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

