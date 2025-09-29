namespace Retroscope.Application.DTOs.RetroBoard;

public class RetroBoardItem
{
    public string Id { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
    public string? TeamId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? RetroStage { get; set; }
    public DateTime? CreatedAt { get; set; }
}