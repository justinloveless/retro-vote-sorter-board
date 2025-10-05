namespace Retroscope.Application.DTOs.RetroBoardConfig;

public sealed class RetroBoardConfigItem
{
    public string Id { get; set; } = string.Empty;
    public string BoardId { get; set; } = string.Empty;
    public bool? AllowAnonymous { get; set; }
    public bool? VotingEnabled { get; set; }
    public int? MaxVotesPerUser { get; set; }
    public bool? ShowAuthorNames { get; set; }
    public bool? RetroStagesEnabled { get; set; }
    public bool? EnforceStageReadiness { get; set; }
    public bool? AllowSelfVotes { get; set; }
    public string? VoteEmoji { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}
