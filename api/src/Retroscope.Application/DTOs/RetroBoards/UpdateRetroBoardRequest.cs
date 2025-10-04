namespace Retroscope.Application.DTOs.RetroBoards;

public sealed class UpdateRetroBoardRequest
{
    public string? Title { get; set; }
    public string? RetroStage { get; set; }
    public bool? Archived { get; set; }
    public string? ArchivedAt { get; set; }
    public string? ArchivedBy { get; set; }
    public bool? Deleted { get; set; }
    public bool? IsPrivate { get; set; }
    public string? PasswordHash { get; set; }
}

