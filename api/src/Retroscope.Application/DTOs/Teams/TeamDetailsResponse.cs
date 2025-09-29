using Retroscope.Application.DTOs.TeamMembers;

namespace Retroscope.Application.DTOs.Teams;

public class TeamDetailsResponse
{
    public TeamItem? Team { get; set; }
    public List<TeamMemberItem> Members { get; set; } = new();
}