namespace Retroscope.Application.DTOs.RetroItems;

public sealed class CreateRetroItemRequest
{
    public string? BoardId { get; set; }
    public string? ColumnId { get; set; }
    public string Text { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? AuthorId { get; set; }
    public string? SessionId { get; set; }
}
