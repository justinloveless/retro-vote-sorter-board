namespace Retroscope.Application.DTOs.Teams;

public class TeamItem
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CreaterId { get; set; }
    public DateTime? CreatedAt { get; set; }
}