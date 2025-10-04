namespace Retroscope.Application.DTOs.RetroBoards;

public sealed class CreateRetroBoardRequest
{
    public string RoomId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public bool IsPrivate { get; set; }
    public string? PasswordHash { get; set; }
    public string? TeamId { get; set; }
    public string? CreatorId { get; set; }
}

