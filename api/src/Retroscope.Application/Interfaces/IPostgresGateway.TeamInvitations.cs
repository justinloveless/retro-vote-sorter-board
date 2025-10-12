using Retroscope.Application.DTOs.TeamInvitations;

namespace Retroscope.Application.Interfaces;

public partial interface IPostgresGateway
{
    Task<TeamInvitationsResponse> GetTeamInvitationsAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamInvitationItem> CreateTeamInvitationAsync(string bearerToken, CreateTeamInvitationRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamInvitationItem> UpdateTeamInvitationAsync(string bearerToken, string invitationId, UpdateTeamInvitationRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
}

