namespace Retroscope.Application.DTOs.TeamInvitations;

public sealed class TeamInvitationItem
{
    public required string Id { get; init; }
    public required string TeamId { get; init; }
    public required string Email { get; init; }
    public required string InvitedBy { get; init; }
    public required string Token { get; init; }
    public required string Status { get; init; } // pending, accepted, declined
    public required string InviteType { get; init; } // email, link
    public required bool IsActive { get; init; }
    public required string ExpiresAt { get; init; }
    public required string CreatedAt { get; init; }
}

