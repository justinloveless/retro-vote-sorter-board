namespace Retroscope.Application.DTOs.RetroComments;

public sealed class CreateRetroCommentRequest
{
    public string ItemId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? AuthorId { get; set; }
    public string? SessionId { get; set; }
}

