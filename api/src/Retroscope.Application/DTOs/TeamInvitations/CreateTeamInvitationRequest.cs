namespace Retroscope.Application.DTOs.TeamInvitations;

public sealed class CreateTeamInvitationRequest
{
    public required string Email { get; init; }
    public required string InviteType { get; init; } // "email" or "link"
}

