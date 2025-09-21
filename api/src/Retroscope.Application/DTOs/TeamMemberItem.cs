namespace Retroscope.Application.DTOs;

public class TeamMemberItem
{
    public string TeamId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty; // "member" or "admin"
}
