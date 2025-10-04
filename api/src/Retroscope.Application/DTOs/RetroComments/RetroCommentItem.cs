namespace Retroscope.Application.DTOs.RetroComments;

public sealed class RetroCommentItem
{
    public string Id { get; set; } = string.Empty;
    public string ItemId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? AuthorId { get; set; }
    public string? SessionId { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public ProfileInfo? Profile { get; set; }
}

public sealed class ProfileInfo
{
    public string? AvatarUrl { get; set; }
    public string? FullName { get; set; }
}

