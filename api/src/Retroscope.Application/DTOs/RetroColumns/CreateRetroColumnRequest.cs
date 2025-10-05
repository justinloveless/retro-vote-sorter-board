namespace Retroscope.Application.DTOs.RetroColumns;

public sealed class CreateRetroColumnRequest
{
    public string? BoardId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int Position { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActionItems { get; set; }
}
