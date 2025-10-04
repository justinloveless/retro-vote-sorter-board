using Retroscope.Application.DTOs.TeamInvitations;

namespace Retroscope.Application.Interfaces;

public partial interface ISupabaseGateway
{
    /// <summary>
    /// Get team invitations with optional filters
    /// </summary>
    Task<IReadOnlyList<TeamInvitationItem>> GetTeamInvitationsAsync(
        string teamId,
        string? inviteType,
        string? status,
        string authorizationHeader,
        CancellationToken ct);

    /// <summary>
    /// Create a new team invitation
    /// </summary>
    Task<TeamInvitationItem> CreateTeamInvitationAsync(
        string teamId,
        CreateTeamInvitationRequest request,
        string userId,
        string authorizationHeader,
        CancellationToken ct);

    /// <summary>
    /// Update a team invitation
    /// </summary>
    Task UpdateTeamInvitationAsync(
        string invitationId,
        UpdateTeamInvitationRequest request,
        string authorizationHeader,
        CancellationToken ct);

    /// <summary>
    /// Delete a team invitation
    /// </summary>
    Task DeleteTeamInvitationAsync(
        string invitationId,
        string authorizationHeader,
        CancellationToken ct);
}

