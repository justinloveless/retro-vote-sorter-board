namespace Retroscope.Application.DTOs.RetroBoards;

public sealed class RetroBoardItem
{
    public string Id { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public bool IsPrivate { get; set; }
    public string? PasswordHash { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public bool Archived { get; set; }
    public string? ArchivedAt { get; set; }
    public string? ArchivedBy { get; set; }
    public bool Deleted { get; set; }
    public string? TeamId { get; set; }
    public string? RetroStage { get; set; }
    public string? CreatorId { get; set; }
    public string UpdatedAt { get; set; } = string.Empty;
}

