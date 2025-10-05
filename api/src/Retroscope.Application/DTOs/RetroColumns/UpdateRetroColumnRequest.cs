namespace Retroscope.Application.DTOs.RetroColumns;

public sealed class UpdateRetroColumnRequest
{
    public string? Title { get; set; }
    public string? Color { get; set; }
    public int? Position { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActionItems { get; set; }
}
