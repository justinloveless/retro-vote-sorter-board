namespace Retroscope.Application.DTOs.TeamInvitations;

public sealed class TeamInvitationsResponse
{
    public required IReadOnlyList<TeamInvitationItem> Items { get; init; }
}

