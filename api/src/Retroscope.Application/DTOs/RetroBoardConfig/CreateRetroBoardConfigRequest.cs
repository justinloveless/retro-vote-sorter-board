namespace Retroscope.Application.DTOs.RetroBoardConfig;

public sealed class CreateRetroBoardConfigRequest
{
    public string BoardId { get; set; } = string.Empty;
    public bool? AllowAnonymous { get; set; }
    public bool? VotingEnabled { get; set; }
    public int? MaxVotesPerUser { get; set; }
    public bool? ShowAuthorNames { get; set; }
    public bool? RetroStagesEnabled { get; set; }
    public bool? EnforceStageReadiness { get; set; }
    public bool? AllowSelfVotes { get; set; }
    public string? VoteEmoji { get; set; }
}
