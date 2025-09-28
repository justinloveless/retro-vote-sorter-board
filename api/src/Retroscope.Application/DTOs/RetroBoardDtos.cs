namespace Retroscope.Application.DTOs;

public class RetroBoardAggregateResponse
{
    public RetroBoardItem? Board { get; set; }
    public object? Config { get; set; }
    public List<RetroColumnItem> Columns { get; set; } = new();
    public List<RetroItem> Items { get; set; } = new();
    public List<RetroComment> Comments { get; set; } = new();
    public List<string> UserVotes { get; set; } = new();
}

public class RetroBoardItem
{
    public string Id { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
    public string? TeamId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? RetroStage { get; set; }
    public DateTime? CreatedAt { get; set; }
}

public class RetroColumnItem
{
    public string Id { get; set; } = string.Empty;
    public string BoardId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int? Position { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActionItems { get; set; }
}

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

public class RetroComment
{
    public string Id { get; set; } = string.Empty;
    public string ItemId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? AuthorId { get; set; }
    public DateTime? CreatedAt { get; set; }
}



