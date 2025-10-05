namespace Retroscope.Application.DTOs.RetroColumns;

public sealed class RetroColumnItem
{
    public string Id { get; set; } = string.Empty;
    public string? BoardId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int Position { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActionItems { get; set; }
    public string? CreatedAt { get; set; }
}
