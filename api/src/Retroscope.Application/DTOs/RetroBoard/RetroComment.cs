namespace Retroscope.Application.DTOs.RetroBoard;

public class RetroComment
{
    public string Id { get; set; } = string.Empty;
    public string ItemId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? AuthorId { get; set; }
    public DateTime? CreatedAt { get; set; }
}