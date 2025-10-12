using Retroscope.Application.DTOs.TeamInvitations;

namespace Retroscope.Infrastructure.Postgres;

public partial class PostgresGateway
{
    public Task<TeamInvitationsResponse> GetTeamInvitationsAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement team invitations query with RLS
        throw new NotImplementedException("Team invitations query not yet implemented in PostgresGateway");
    }

    public Task<TeamInvitationItem> CreateTeamInvitationAsync(string bearerToken, CreateTeamInvitationRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement create team invitation with RLS
        throw new NotImplementedException("Create team invitation not yet implemented in PostgresGateway");
    }

    public Task<TeamInvitationItem> UpdateTeamInvitationAsync(string bearerToken, string invitationId, UpdateTeamInvitationRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement update team invitation with RLS
        throw new NotImplementedException("Update team invitation not yet implemented in PostgresGateway");
    }
}

