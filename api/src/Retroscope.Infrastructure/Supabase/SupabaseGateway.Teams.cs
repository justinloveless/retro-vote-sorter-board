using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Retroscope.Application.DTOs;
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

            var membersReq = new HttpRequestMessage(HttpMethod.Get, $"team_members?select=user_id,team_id,role&team_id=eq.{teamId}");
            membersReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) membersReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) membersReq.Headers.Add("X-Correlation-Id", correlationId);

            var membersResp = await _postgrestClient.SendAsync(membersReq, cancellationToken);
            if (!membersResp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch team members. Status: {StatusCode}", membersResp.StatusCode);
                throw new HttpException(membersResp.StatusCode, $"Supabase request failed with status {membersResp.StatusCode}");
            }

            var membersJson = await membersResp.Content.ReadAsStringAsync(cancellationToken);
            var memberRows = JsonSerializer.Deserialize<List<JsonElement>>(membersJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();

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

            var req = new HttpRequestMessage(HttpMethod.Get, path);
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            if (!resp.IsSuccessStatusCode)
            {
                throw new HttpException(resp.StatusCode, $"Supabase request failed with status {resp.StatusCode}");
            }

            var json = await resp.Content.ReadAsStringAsync(cancellationToken);
            var rows = JsonSerializer.Deserialize<List<JsonElement>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            var items = new List<TeamItem>();
            foreach (var r in rows)
            {
                var team = new TeamItem
                {
                    Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                    Name = r.TryGetProperty("name", out var nm) ? nm.GetString() ?? string.Empty : string.Empty,
                    Description = r.TryGetProperty("description", out var desc) ? desc.GetString() : null,
                    CreaterId = r.TryGetProperty("creator_id", out var ow) ? ow.GetString() : null,
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
            var teamReq = new HttpRequestMessage(HttpMethod.Get, $"teams?id=eq.{teamId}");
            teamReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) teamReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) teamReq.Headers.Add("X-Correlation-Id", correlationId);

            var teamResp = await _postgrestClient.SendAsync(teamReq, cancellationToken);
            if (teamResp.StatusCode == HttpStatusCode.NotFound)
            {
                return new TeamDetailsResponse();
            }
            if (!teamResp.IsSuccessStatusCode)
            {
                throw new HttpException(teamResp.StatusCode, $"Supabase request failed with status {teamResp.StatusCode}");
            }

            var teamJson = await teamResp.Content.ReadAsStringAsync(cancellationToken);
            var teamRows = JsonSerializer.Deserialize<List<JsonElement>>(teamJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            var teamRow = teamRows.FirstOrDefault();
            if (teamRow.ValueKind == JsonValueKind.Undefined)
            {
                return new TeamDetailsResponse();
            }

            var team = new TeamItem
            {
                Id = teamRow.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : teamId,
                Name = teamRow.TryGetProperty("name", out var nm) ? nm.GetString() ?? string.Empty : string.Empty,
                Description = teamRow.TryGetProperty("description", out var desc) ? desc.GetString() : null,
                CreaterId = teamRow.TryGetProperty("creator_id", out var ow) ? ow.GetString() : null,
                CreatedAt = teamRow.TryGetProperty("created_at", out var ca) && ca.ValueKind == JsonValueKind.String ? DateTime.Parse(ca.GetString()!) : null
            };

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
            var body = JsonSerializer.Serialize(new { name = request.Name });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, "teams") { Content = content };
            httpRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) httpRequest.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) httpRequest.Headers.Add("X-Correlation-Id", correlationId);

            var response = await _postgrestClient.SendAsync(httpRequest, cancellationToken);
            if (!response.IsSuccessStatusCode) throw new HttpException(response.StatusCode, $"Supabase request failed with status {response.StatusCode}");

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var rows = JsonSerializer.Deserialize<List<JsonElement>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            var r = rows.FirstOrDefault();
            return new TeamItem
            {
                Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                Name = r.TryGetProperty("name", out var nm) ? nm.GetString() ?? string.Empty : string.Empty,
                Description = r.TryGetProperty("description", out var desc) ? desc.GetString() : null,
                CreaterId = r.TryGetProperty("creator_id", out var ow) ? ow.GetString() : null,
                CreatedAt = r.TryGetProperty("created_at", out var ca) && ca.ValueKind == JsonValueKind.String ? DateTime.Parse(ca.GetString()!) : null,
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
            var body = JsonSerializer.Serialize(new { name = request.Name });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var httpRequest = new HttpRequestMessage(HttpMethod.Patch, $"teams?id=eq.{teamId}") { Content = content };
            httpRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) httpRequest.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) httpRequest.Headers.Add("X-Correlation-Id", correlationId);

            var response = await _postgrestClient.SendAsync(httpRequest, cancellationToken);
            if (!response.IsSuccessStatusCode) throw new HttpException(response.StatusCode, $"Supabase request failed with status {response.StatusCode}");

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var rows = JsonSerializer.Deserialize<List<JsonElement>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            var r = rows.FirstOrDefault();
            return new TeamItem
            {
                Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : teamId,
                Name = r.TryGetProperty("name", out var nm) ? nm.GetString() ?? string.Empty : request.Name,
                Description = r.TryGetProperty("description", out var desc) ? desc.GetString() : null,
                CreaterId = r.TryGetProperty("owner_id", out var ow) ? ow.GetString() : null,
                CreatedAt = r.TryGetProperty("created_at", out var ca) && ca.ValueKind == JsonValueKind.String ? DateTime.Parse(ca.GetString()!) : null,
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
            var httpRequest = new HttpRequestMessage(HttpMethod.Delete, $"teams?id=eq.{teamId}");
            httpRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) httpRequest.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) httpRequest.Headers.Add("X-Correlation-Id", correlationId);

            var response = await _postgrestClient.SendAsync(httpRequest, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting team {TeamId}", teamId);
            throw;
        }
    }

    public async Task<bool> AddMemberAsync(string bearerToken, string teamId, AddMemberRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var body = JsonSerializer.Serialize(new { team_id = teamId, user_id = request.UserId, role = request.Role });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, "team_members") { Content = content };
            httpRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) httpRequest.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) httpRequest.Headers.Add("X-Correlation-Id", correlationId);

            var response = await _postgrestClient.SendAsync(httpRequest, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding member {UserId} to team {TeamId}", request.UserId, teamId);
            throw;
        }
    }

    public async Task<bool> UpdateMemberRoleAsync(string bearerToken, string teamId, string userId, UpdateMemberRoleRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var body = JsonSerializer.Serialize(new { role = request.Role });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var path = $"team_members?team_id=eq.{teamId}&user_id=eq.{userId}";
            var httpRequest = new HttpRequestMessage(HttpMethod.Patch, path) { Content = content };
            httpRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) httpRequest.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) httpRequest.Headers.Add("X-Correlation-Id", correlationId);

            var response = await _postgrestClient.SendAsync(httpRequest, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating member role {UserId} in team {TeamId}", userId, teamId);
            throw;
        }
    }

    public async Task<bool> RemoveMemberAsync(string bearerToken, string teamId, string userId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var path = $"team_members?team_id=eq.{teamId}&user_id=eq.{userId}";
            var httpRequest = new HttpRequestMessage(HttpMethod.Delete, path);
            httpRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) httpRequest.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) httpRequest.Headers.Add("X-Correlation-Id", correlationId);

            var response = await _postgrestClient.SendAsync(httpRequest, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing member {UserId} from team {TeamId}", userId, teamId);
            throw;
        }
    }
}


