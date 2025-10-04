namespace Retroscope.Application.DTOs.RetroBoards;

public sealed class BoardTitlesResponse
{
    public List<BoardTitleItem> Items { get; set; } = new();
}

public sealed class BoardTitleItem
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
}

