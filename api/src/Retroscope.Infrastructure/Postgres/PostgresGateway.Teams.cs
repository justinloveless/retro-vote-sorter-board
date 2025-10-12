using Retroscope.Application.DTOs.Teams;
using Retroscope.Application.DTOs.TeamMembers;

namespace Retroscope.Infrastructure.Postgres;

public partial class PostgresGateway
{
    public Task<TeamsResponse> GetTeamsAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement full teams query with RLS
        throw new NotImplementedException("Teams query not yet implemented in PostgresGateway");
    }

    public Task<TeamDetailsResponse> GetTeamAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement team details with RLS
        throw new NotImplementedException("Team details not yet implemented in PostgresGateway");
    }

    public Task<TeamItem> CreateTeamAsync(string bearerToken, CreateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement team creation with RLS
        throw new NotImplementedException("Create team not yet implemented in PostgresGateway");
    }

    public Task<TeamItem> UpdateTeamAsync(string bearerToken, string teamId, UpdateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement team update with RLS
        throw new NotImplementedException("Update team not yet implemented in PostgresGateway");
    }

    public Task DeleteTeamAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement team deletion with RLS
        throw new NotImplementedException("Delete team not yet implemented in PostgresGateway");
    }

    public Task<TeamMembersResponse> GetTeamMembersAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement team members with RLS
        throw new NotImplementedException("Team members not yet implemented in PostgresGateway");
    }

    public Task<TeamMemberItem> AddTeamMemberAsync(string bearerToken, string teamId, AddMemberRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement add team member with RLS
        throw new NotImplementedException("Add team member not yet implemented in PostgresGateway");
    }

    public Task RemoveTeamMemberAsync(string bearerToken, string teamId, string userId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement remove team member with RLS
        throw new NotImplementedException("Remove team member not yet implemented in PostgresGateway");
    }

    public Task<TeamMemberItem> UpdateTeamMemberRoleAsync(string bearerToken, string teamId, string userId, UpdateMemberRoleRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement update member role with RLS
        throw new NotImplementedException("Update member role not yet implemented in PostgresGateway");
    }

    public Task<TeamNameResponse> GetTeamNameAsync(string bearerToken, TeamNameRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        // TODO: Implement get team name with RLS
        throw new NotImplementedException("Get team name not yet implemented in PostgresGateway");
    }
}

