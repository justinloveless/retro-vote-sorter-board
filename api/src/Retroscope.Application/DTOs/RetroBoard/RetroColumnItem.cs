namespace Retroscope.Application.DTOs.RetroBoard;

public class RetroColumnItem
{
    public string Id { get; set; } = string.Empty;
    public string BoardId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int? Position { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActionItems { get; set; }
}