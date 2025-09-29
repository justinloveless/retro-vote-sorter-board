namespace Retroscope.Application.DTOs.RetroBoard;

public class RetroItem
{
    public string Id { get; set; } = string.Empty;
    public string BoardId { get; set; } = string.Empty;
    public string ColumnId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? AuthorId { get; set; }
    public int Votes { get; set; }
    public DateTime? CreatedAt { get; set; }
    public string? SessionId { get; set; }
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
}