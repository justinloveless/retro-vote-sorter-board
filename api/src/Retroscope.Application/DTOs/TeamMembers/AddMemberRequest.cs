namespace Retroscope.Application.DTOs.TeamMembers;

public class AddMemberRequest
{
    public string UserId { get; set; } = string.Empty;
    public string Role { get; set; } = "member";
}