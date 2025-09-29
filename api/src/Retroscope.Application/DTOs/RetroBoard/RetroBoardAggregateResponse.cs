namespace Retroscope.Application.DTOs.RetroBoard;

public class RetroBoardAggregateResponse
{
    public RetroBoardItem? Board { get; set; }
    public object? Config { get; set; }
    public List<RetroColumnItem> Columns { get; set; } = new();
    public List<RetroItem> Items { get; set; } = new();
    public List<RetroComment> Comments { get; set; } = new();
    public List<string> UserVotes { get; set; } = new();
}