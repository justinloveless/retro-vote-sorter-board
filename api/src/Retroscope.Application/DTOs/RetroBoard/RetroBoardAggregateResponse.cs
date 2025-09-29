namespace Retroscope.Application.DTOs.RetroBoard;

public class RetroBoardAggregateResponse
{
    public RetroBoardItem? Board { get; set; }
    public object? Config { get; set; }
    public List<RetroColumnItem> Columns { get; set; } = [];
    public List<RetroItem> Items { get; set; } = [];
    public List<RetroComment> Comments { get; set; } = [];
    public List<string> UserVotes { get; set; } = [];
}