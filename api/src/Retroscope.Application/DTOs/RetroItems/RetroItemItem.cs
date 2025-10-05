namespace Retroscope.Application.DTOs.RetroItems;

public sealed class RetroItemItem
{
    public string Id { get; set; } = string.Empty;
    public string? BoardId { get; set; }
    public string? ColumnId { get; set; }
    public string Text { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? AuthorId { get; set; }
    public int? Votes { get; set; }
    public string? SessionId { get; set; }
    public string? CreatedAt { get; set; }
    public string? UpdatedAt { get; set; }
}
