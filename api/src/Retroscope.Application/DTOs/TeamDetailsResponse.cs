namespace Retroscope.Application.DTOs;

public class TeamDetailsResponse
{
    public TeamItem? Team { get; set; }
    public List<TeamMemberItem> Members { get; set; } = new();
}

public class TeamItem
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CreaterId { get; set; }
    public DateTime? CreatedAt { get; set; }
}

public class UpdateTeamRequest
{
    public string Name { get; set; } = string.Empty;
}

public class AddMemberRequest
{
    public string UserId { get; set; } = string.Empty;
    public string Role { get; set; } = "member";
}

public class UpdateMemberRoleRequest
{
    public string Role { get; set; } = "member";
}


