using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Retroscope.Application.DTOs.TeamMembers;
using Retroscope.Application.DTOs.Teams;

namespace Retroscope.Infrastructure.Supabase;

public partial class SupabaseGateway
{
    public async Task<TeamMembersResponse> GetTeamMembersAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Fetching team members for team {TeamId}", teamId);

            var memberRows = await GetPostgrestAsync<JsonElement>($"team_members?select=user_id,team_id,role&team_id=eq.{teamId}", cancellationToken);

            var teamMembers = new List<TeamMemberItem>();
            var userIdsForProfiles = new List<string>();
            foreach (var row in memberRows)
            {
                var uid = row.GetProperty("user_id").GetString() ?? string.Empty;
                if (!string.IsNullOrEmpty(uid)) userIdsForProfiles.Add(uid);
                teamMembers.Add(new TeamMemberItem
                {
                    TeamId = row.GetProperty("team_id").GetString() ?? string.Empty,
                    UserId = uid,
                    Role = row.GetProperty("role").GetString() ?? string.Empty,
                    DisplayName = string.Empty,
                    Email = string.Empty
                });
            }

            var profileMap = await FetchProfilesAsync(userIdsForProfiles, bearerToken, correlationId, cancellationToken);
            for (var i = 0; i < teamMembers.Count; i++)
            {
                var tm = teamMembers[i];
                if (!string.IsNullOrEmpty(tm.UserId) && profileMap.TryGetValue(tm.UserId, out var profileInfo))
                {
                    teamMembers[i].DisplayName = profileInfo.fullName ?? string.Empty;
                    teamMembers[i].Email = profileInfo.email ?? string.Empty;
                }
            }

            return new TeamMembersResponse { Items = teamMembers };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching team members for team {TeamId}", teamId);
            throw;
        }
    }

    public async Task<TeamsResponse> GetTeamsAsync(string bearerToken, bool includeAll = false, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var userId = ExtractUserIdFromToken(bearerToken);
            var path = includeAll
                ? "teams?select=*,team_members(role,user_id)&order=created_at.desc"
                : $"teams?select=*,team_members!inner(role,user_id)&team_members.user_id=eq.{userId}&order=created_at.desc";

            var rows = await GetPostgrestAsync<JsonElement>(path, cancellationToken);
            var items = new List<TeamItem>();
            foreach (var r in rows)
            {
                var team = new TeamItem
                {
                    Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                    Name = r.TryGetProperty("name", out var nm) ? nm.GetString() ?? string.Empty : string.Empty,
                    Description = r.TryGetProperty("description", out var desc) ? desc.GetString() : null,
                    CreatorId = r.TryGetProperty("creator_id", out var ow) ? ow.GetString() : null,
                    CreatedAt = r.TryGetProperty("created_at", out var ca) && ca.ValueKind == JsonValueKind.String ? DateTime.Parse(ca.GetString()!) : null,
                };

                if (r.TryGetProperty("team_members", out var membersEl) && membersEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var m in membersEl.EnumerateArray())
                    {
                        var uid = m.TryGetProperty("user_id", out var u) ? u.GetString() : null;
                        if (!string.IsNullOrEmpty(userId) && uid == userId)
                        {
                            break;
                        }
                    }
                }

                items.Add(team);
            }

            return new TeamsResponse { Items = items };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching teams");
            throw;
        }
    }

    public async Task<TeamDetailsResponse> GetTeamByIdAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var team = await GetSinglePostgrestAsync<TeamItem>($"teams?id=eq.{teamId}", cancellationToken);

            var memberResponse = await GetTeamMembersAsync(bearerToken, teamId, correlationId, cancellationToken);
            var members = memberResponse.Items.ToList();

            var userIds = members.Select(m => m.UserId).Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
            var profileMap = await FetchProfilesAsync(userIds, bearerToken, correlationId, cancellationToken);
            foreach (var member in members)
            {
                if (profileMap.TryGetValue(member.UserId, out var profileInfo))
                {
                    member.DisplayName = profileInfo.fullName ?? member.DisplayName;
                    member.Email = profileInfo.email ?? member.Email;
                }
            }

            return new TeamDetailsResponse { Team = team, Members = members };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching team {TeamId}", teamId);
            throw;
        }
    }

    public async Task<TeamItem> CreateTeamAsync(string bearerToken, CreateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var userId = ExtractUserIdFromToken(bearerToken);
            await PostPostgrestAsync("teams",
                new { name = request.Name, description = request.Description, creator_id = userId },
                cancellationToken: cancellationToken
            );

            var items = await GetPostgrestAsync<TeamItem>($"teams?select=*&creator_id=eq.{userId}&order=created_at.desc&limit=1", cancellationToken);
            var created = items.FirstOrDefault();
            if (created != null) return created;

            return new TeamItem
            {
                Id = string.Empty,
                Name = request.Name,
                Description = request.Description,
                CreatorId = userId,
                CreatedAt = null
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating team");
            throw;
        }
    }

    public async Task<TeamItem> UpdateTeamAsync(string bearerToken, string teamId, UpdateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var updated = await PatchPostgrestAsync<TeamItem>($"teams?id=eq.{teamId}", new { name = request.Name }, cancellationToken);
            if (updated != null) return updated;

            // Fallback if no response
            return new TeamItem
            {
                Id = teamId,
                Name = request.Name,
                Description = null,
                CreatorId = null,
                CreatedAt = null
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating team {TeamId}", teamId);
            throw;
        }
    }

    public async Task<bool> DeleteTeamAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            await DeletePostgrestAsync($"teams?id=eq.{teamId}", cancellationToken: cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting team {TeamId}", teamId);
            return false;
        }
    }

    public async Task<bool> AddMemberAsync(string bearerToken, string teamId, AddMemberRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            await PostPostgrestAsync("team_members", new { team_id = teamId, user_id = request.UserId, role = request.Role }, cancellationToken: cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding member {UserId} to team {TeamId}", request.UserId, teamId);
            return false;
        }
    }

    public async Task<bool> UpdateMemberRoleAsync(string bearerToken, string teamId, string userId, UpdateMemberRoleRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            await PatchPostgrestAsync($"team_members?team_id=eq.{teamId}&user_id=eq.{userId}", new { role = request.Role }, cancellationToken: cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating member role {UserId} in team {TeamId}", userId, teamId);
            return false;
        }
    }

    public async Task<bool> RemoveMemberAsync(string bearerToken, string teamId, string userId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            await DeletePostgrestAsync($"team_members?team_id=eq.{teamId}&user_id=eq.{userId}", cancellationToken: cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing member {UserId} from team {TeamId}", userId, teamId);
            return false;
        }
    }
}


