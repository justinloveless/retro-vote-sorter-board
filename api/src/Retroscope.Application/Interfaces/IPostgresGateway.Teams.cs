using Retroscope.Application.DTOs.Teams;
using Retroscope.Application.DTOs.TeamMembers;

namespace Retroscope.Application.Interfaces;

public partial interface IPostgresGateway
{
    Task<TeamsResponse> GetTeamsAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamDetailsResponse> GetTeamAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamItem> CreateTeamAsync(string bearerToken, CreateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamItem> UpdateTeamAsync(string bearerToken, string teamId, UpdateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task DeleteTeamAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamMembersResponse> GetTeamMembersAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamMemberItem> AddTeamMemberAsync(string bearerToken, string teamId, AddMemberRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task RemoveTeamMemberAsync(string bearerToken, string teamId, string userId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamMemberItem> UpdateTeamMemberRoleAsync(string bearerToken, string teamId, string userId, UpdateMemberRoleRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamNameResponse> GetTeamNameAsync(string bearerToken, TeamNameRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
}

