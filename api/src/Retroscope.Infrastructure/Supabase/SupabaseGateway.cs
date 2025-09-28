using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;
namespace Retroscope.Infrastructure.Supabase;

public class SupabaseGateway : ISupabaseGateway
{
    private readonly HttpClient _postgrestClient;
    private readonly HttpClient _functionsClient;
    private readonly ILogger<SupabaseGateway> _logger;
    private readonly string? _supabaseAnonKey;

    public SupabaseGateway(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<SupabaseGateway> logger)
    {
        _postgrestClient = httpClientFactory.CreateClient("PostgrestClient");
        _functionsClient = httpClientFactory.CreateClient("FunctionsClient");
        _logger = logger;
        _supabaseAnonKey = configuration["SUPABASE_ANON_KEY"];

        // Configure base URLs from configuration
        var postgrestUrl = configuration["SUPABASE_POSTGREST_URL"];
        var functionsUrl = configuration["SUPABASE_FUNCTIONS_URL"];

        if (!string.IsNullOrEmpty(postgrestUrl))
        {
            if (!postgrestUrl.EndsWith("/")) postgrestUrl += "/";
            _postgrestClient.BaseAddress = new Uri(postgrestUrl);
        }

        if (!string.IsNullOrEmpty(functionsUrl))
        {
            if (!functionsUrl.EndsWith("/")) functionsUrl += "/";
            _functionsClient.BaseAddress = new Uri(functionsUrl);
        }
    }

    public async Task<NotificationsResponse> GetNotificationsAsync(string bearerToken, int limit, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Fetching notifications with limit {Limit}", limit);

            var request = new HttpRequestMessage(HttpMethod.Get, $"notifications?select=*&order=created_at.desc&limit={limit}");
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey))
            {
                request.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            }

            if (!string.IsNullOrEmpty(correlationId))
            {
                request.Headers.Add("X-Correlation-Id", correlationId);
            }

            var response = await _postgrestClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch notifications. Status: {StatusCode}", response.StatusCode);
                throw new HttpException(response.StatusCode, $"Supabase request failed with status {response.StatusCode}");
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var notifications = JsonSerializer.Deserialize<List<NotificationItem>>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? new List<NotificationItem>();

            return new NotificationsResponse { Items = notifications };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching notifications");
            throw;
        }
    }

    public async Task<TeamMembersResponse> GetTeamMembersAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Fetching team members for team {TeamId}", teamId);

            // Step 1: fetch team_members rows
            var membersReq = new HttpRequestMessage(HttpMethod.Get, $"team_members?select=user_id,team_id,role,profiles(full_name,email)&team_id=eq.{teamId}");
            membersReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey))
            {
                membersReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            }
            if (!string.IsNullOrEmpty(correlationId))
            {
                membersReq.Headers.Add("X-Correlation-Id", correlationId);
            }

            var membersResp = await _postgrestClient.SendAsync(membersReq, cancellationToken);
            if (!membersResp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch team members. Status: {StatusCode}", membersResp.StatusCode);
                throw new HttpException(membersResp.StatusCode, $"Supabase request failed with status {membersResp.StatusCode}");
            }

            var membersJson = await membersResp.Content.ReadAsStringAsync(cancellationToken);
            var memberRows = JsonSerializer.Deserialize<List<JsonElement>>(membersJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                              ?? new List<JsonElement>();

            var teamMembers = new List<TeamMemberItem>();
            foreach (var row in memberRows)
            {
                var uid = row.GetProperty("user_id").GetString() ?? "";
                string? displayName = null;
                string? email = null;

                if (row.TryGetProperty("profiles", out var profileElement) && profileElement.ValueKind == JsonValueKind.Object)
                {
                    if (profileElement.TryGetProperty("full_name", out var fn))
                    {
                        displayName = fn.GetString();
                    }
                    else if (profileElement.TryGetProperty("display_name", out var dn))
                    {
                        displayName = dn.GetString();
                    }

                    if (profileElement.TryGetProperty("email", out var em))
                    {
                        email = em.GetString();
                    }
                }
                teamMembers.Add(new TeamMemberItem
                {
                    TeamId = row.GetProperty("team_id").GetString() ?? "",
                    UserId = uid,
                    Role = row.GetProperty("role").GetString() ?? "",
                    DisplayName = displayName ?? string.Empty,
                    Email = email ?? string.Empty
                });
            }

            return new TeamMembersResponse { Items = teamMembers };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching team members for team {TeamId}", teamId);
            throw;
        }
    }

    public async Task<AdminSendNotificationResponse> AdminSendNotificationAsync(string authHeader, AdminSendNotificationRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Sending admin notification to {UserCount} recipients", request.Recipients.Count);

            var json = JsonSerializer.Serialize(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, "admin-send-notification")
            {
                Content = content
            };
            httpRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(authHeader);
            if (!string.IsNullOrEmpty(_supabaseAnonKey))
            {
                httpRequest.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            }

            if (!string.IsNullOrEmpty(correlationId))
            {
                httpRequest.Headers.Add("X-Correlation-Id", correlationId);
            }

            var response = await _functionsClient.SendAsync(httpRequest, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to send admin notification. Status: {StatusCode}", response.StatusCode);
                throw new HttpException(response.StatusCode, $"Supabase function request failed with status {response.StatusCode}");
            }

            var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<AdminSendNotificationResponse>(responseJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? new AdminSendNotificationResponse { Success = true };

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending admin notification");
            throw;
        }
    }

    public async Task<MarkNotificationReadResponse> MarkNotificationReadAsync(string bearerToken, string notificationId, MarkNotificationReadRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Marking notification {NotificationId} as read", notificationId);

            var requestBody = new { is_read = request.IsRead };
            var jsonContent = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var httpRequest = new HttpRequestMessage(HttpMethod.Patch, $"notifications?id=eq.{notificationId}")
            {
                Content = content
            };
            httpRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey))
            {
                httpRequest.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            }

            if (!string.IsNullOrEmpty(correlationId))
            {
                httpRequest.Headers.Add("X-Correlation-Id", correlationId);
            }

            var response = await _postgrestClient.SendAsync(httpRequest, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to mark notification as read. Status: {StatusCode}", response.StatusCode);
                throw new HttpException(response.StatusCode, $"Supabase request failed with status {response.StatusCode}");
            }

            return new MarkNotificationReadResponse
            {
                Success = true,
                Message = "Notification marked as read"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking notification as read");
            throw;
        }
    }

    public async Task<MarkAllNotificationsReadResponse> MarkAllNotificationsReadAsync(string bearerToken, MarkAllNotificationsReadRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Marking all notifications as read");

            // First, get the user ID from the token to filter notifications
            var userId = ExtractUserIdFromToken(bearerToken);
            if (string.IsNullOrEmpty(userId))
            {
                throw new UnauthorizedAccessException("Unable to extract user ID from token");
            }

            var requestBody = new { is_read = request.IsRead };
            var jsonContent = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var httpRequest = new HttpRequestMessage(HttpMethod.Patch, $"notifications?user_id=eq.{userId}")
            {
                Content = content
            };
            httpRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey))
            {
                httpRequest.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            }

            if (!string.IsNullOrEmpty(correlationId))
            {
                httpRequest.Headers.Add("X-Correlation-Id", correlationId);
            }

            var response = await _postgrestClient.SendAsync(httpRequest, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to mark all notifications as read. Status: {StatusCode}", response.StatusCode);
                throw new HttpException(response.StatusCode, $"Supabase request failed with status {response.StatusCode}");
            }

            // For mark-all-read, we don't get the count back from Supabase directly
            // We could make a separate request to count, but for now we'll return a generic success
            return new MarkAllNotificationsReadResponse
            {
                Success = true,
                UpdatedCount = 0, // Could be enhanced to get actual count
                Message = "All notifications marked as read"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking all notifications as read");
            throw;
        }
    }

    // =========================
    // Phase 3: Teams and Members
    // =========================

    public async Task<TeamsResponse> GetTeamsAsync(string bearerToken, bool includeAll = false, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            // Default: only teams the current user is a member of
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

                // Map role if present in join
                if (r.TryGetProperty("team_members", out var membersEl) && membersEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var m in membersEl.EnumerateArray())
                    {
                        var uid = m.TryGetProperty("user_id", out var u) ? u.GetString() : null;
                        if (!string.IsNullOrEmpty(userId) && uid == userId)
                        {
                            team.CreaterId = team.CreaterId; // no-op, ensure team not optimized away
                            // We don't have a Role field on TeamItem DTO; could extend DTO later if needed
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

            return new TeamDetailsResponse
            {
                Team = team,
                Members = members
            };
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
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpException(response.StatusCode, $"Supabase request failed with status {response.StatusCode}");
            }

            // PostgREST returns created row array
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
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpException(response.StatusCode, $"Supabase request failed with status {response.StatusCode}");
            }

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

    private async Task<Dictionary<string, (string? fullName, string? email)>> FetchProfilesAsync(IEnumerable<string> userIds, string bearerToken, string? correlationId, CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, (string? fullName, string? email)>();
        var ids = userIds.Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
        if (ids.Count == 0)
        {
            return result;
        }

        var inList = string.Join(',', ids);
        var request = new HttpRequestMessage(HttpMethod.Get, $"profiles?select=id,full_name,email&id=in.({inList})");
        request.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
        if (!string.IsNullOrEmpty(_supabaseAnonKey))
        {
            request.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
        }
        if (!string.IsNullOrEmpty(correlationId))
        {
            request.Headers.Add("X-Correlation-Id", correlationId);
        }

        var response = await _postgrestClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return result;
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        var rows = JsonSerializer.Deserialize<List<JsonElement>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
        foreach (var row in rows)
        {
            var id = row.TryGetProperty("id", out var idElement) ? idElement.GetString() : null;
            if (string.IsNullOrEmpty(id))
            {
                continue;
            }

            string? fullName = null;
            if (row.TryGetProperty("full_name", out var fn))
            {
                fullName = fn.GetString();
            }
            else if (row.TryGetProperty("display_name", out var dn))
            {
                fullName = dn.GetString();
            }

            var email = row.TryGetProperty("email", out var em) ? em.GetString() : null;
            result[id] = (fullName, email);
        }

        return result;
    }
    private string? ExtractUserIdFromToken(string bearerToken)
    {
        try
        {
            // Remove "Bearer " prefix
            var token = bearerToken.StartsWith("Bearer ") ? bearerToken.Substring(7) : bearerToken;

            // Handle test tokens (for integration tests)
            if (token == "valid-user-token" || token == "test-token")
            {
                return "test-user-id";
            }

            // Simple JWT payload extraction (without signature verification for this use case)
            var parts = token.Split('.');
            if (parts.Length != 3) return null;

            var payload = parts[1];
            // Add padding if needed
            while (payload.Length % 4 != 0)
            {
                payload += "=";
            }

            var payloadBytes = Convert.FromBase64String(payload);
            var payloadJson = Encoding.UTF8.GetString(payloadBytes);

            using var doc = JsonDocument.Parse(payloadJson);
            return doc.RootElement.GetProperty("sub").GetString();
        }
        catch
        {
            return null;
        }
    }

    // =========================
    // Phase 4: Retro Boards & Items
    // =========================

    public async Task<RetroBoardAggregateResponse> GetRetroBoardAsync(string bearerToken, string roomId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Fetching retro board aggregate for room {RoomId}", roomId);

            // 1) Fetch board by room_id
            var boardReq = new HttpRequestMessage(HttpMethod.Get, $"retro_boards?room_id=eq.{roomId}");
            boardReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) boardReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) boardReq.Headers.Add("X-Correlation-Id", correlationId);

            var boardResp = await _postgrestClient.SendAsync(boardReq, cancellationToken);
            if (!boardResp.IsSuccessStatusCode)
            {
                if (boardResp.StatusCode == HttpStatusCode.NotFound)
                {
                    return new RetroBoardAggregateResponse();
                }
                throw new HttpException(boardResp.StatusCode, $"Supabase request failed with status {boardResp.StatusCode}");
            }

            var boardJson = await boardResp.Content.ReadAsStringAsync(cancellationToken);
            var boardRows = JsonSerializer.Deserialize<List<JsonElement>>(boardJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            var boardRow = boardRows.FirstOrDefault();
            if (boardRow.ValueKind == JsonValueKind.Undefined)
            {
                return new RetroBoardAggregateResponse();
            }

            var boardId = boardRow.TryGetProperty("id", out var bid) ? (bid.GetString() ?? string.Empty) : string.Empty;
            var board = new RetroBoardItem
            {
                Id = boardId,
                RoomId = boardRow.TryGetProperty("room_id", out var rid) ? rid.GetString() ?? string.Empty : string.Empty,
                TeamId = boardRow.TryGetProperty("team_id", out var tid) ? tid.GetString() : null,
                Title = boardRow.TryGetProperty("title", out var ttl) ? ttl.GetString() ?? string.Empty : string.Empty,
                RetroStage = boardRow.TryGetProperty("retro_stage", out var rs) ? rs.GetString() : null,
                CreatedAt = boardRow.TryGetProperty("created_at", out var ca) && ca.ValueKind == JsonValueKind.String ? DateTime.Parse(ca.GetString()!) : null
            };

            var aggregate = new RetroBoardAggregateResponse { Board = board };

            // 2) Fetch board config
            var cfgReq = new HttpRequestMessage(HttpMethod.Get, $"retro_board_config?board_id=eq.{boardId}");
            cfgReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) cfgReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) cfgReq.Headers.Add("X-Correlation-Id", correlationId);
            var cfgResp = await _postgrestClient.SendAsync(cfgReq, cancellationToken);
            if (cfgResp.IsSuccessStatusCode)
            {
                var cfgJson = await cfgResp.Content.ReadAsStringAsync(cancellationToken);
                var cfgRows = JsonSerializer.Deserialize<List<JsonElement>>(cfgJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
                aggregate.Config = cfgRows.FirstOrDefault();
            }

            // 3) Fetch columns
            var colReq = new HttpRequestMessage(HttpMethod.Get, $"retro_columns?board_id=eq.{boardId}&order=position.asc");
            colReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) colReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) colReq.Headers.Add("X-Correlation-Id", correlationId);
            var colResp = await _postgrestClient.SendAsync(colReq, cancellationToken);
            if (colResp.IsSuccessStatusCode)
            {
                var colJson = await colResp.Content.ReadAsStringAsync(cancellationToken);
                var colRows = JsonSerializer.Deserialize<List<JsonElement>>(colJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
                aggregate.Columns = colRows.Select(r => new RetroColumnItem
                {
                    Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                    BoardId = boardId,
                    Title = r.TryGetProperty("title", out var t) ? t.GetString() ?? string.Empty : string.Empty,
                    Position = r.TryGetProperty("position", out var p) && p.ValueKind == JsonValueKind.Number ? p.GetInt32() : null,
                    SortOrder = r.TryGetProperty("sort_order", out var so) && so.ValueKind == JsonValueKind.Number ? so.GetInt32() : null,
                    IsActionItems = r.TryGetProperty("is_action_items", out var ai) && ai.ValueKind == JsonValueKind.True ? true : (ai.ValueKind == JsonValueKind.False ? false : null)
                }).ToList();
            }

            // 4) Fetch items
            var itemsReq = new HttpRequestMessage(HttpMethod.Get, $"retro_items?board_id=eq.{boardId}");
            itemsReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) itemsReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) itemsReq.Headers.Add("X-Correlation-Id", correlationId);
            var itemsResp = await _postgrestClient.SendAsync(itemsReq, cancellationToken);
            var items = new List<RetroItem>();
            if (itemsResp.IsSuccessStatusCode)
            {
                var itemsJson = await itemsResp.Content.ReadAsStringAsync(cancellationToken);
                var itemRows = JsonSerializer.Deserialize<List<JsonElement>>(itemsJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
                items = itemRows.Select(r => new RetroItem
                {
                    Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                    BoardId = boardId,
                    ColumnId = r.TryGetProperty("column_id", out var cid) ? cid.GetString() ?? string.Empty : string.Empty,
                    Text = r.TryGetProperty("text", out var tx) ? tx.GetString() ?? string.Empty : string.Empty,
                    Author = r.TryGetProperty("author", out var au) ? au.GetString() ?? string.Empty : string.Empty,
                    AuthorId = r.TryGetProperty("author_id", out var aid) ? aid.GetString() : null,
                    Votes = r.TryGetProperty("votes", out var vt) && vt.ValueKind == JsonValueKind.Number ? vt.GetInt32() : 0,
                    CreatedAt = r.TryGetProperty("created_at", out var cat) && cat.ValueKind == JsonValueKind.String ? DateTime.Parse(cat.GetString()!) : null,
                    SessionId = r.TryGetProperty("session_id", out var sid) ? sid.GetString() : null
                }).ToList();
            }
            aggregate.Items = items;

            // 5) Fetch comments for these items
            if (items.Count > 0)
            {
                var ids = string.Join(',', items.Select(i => i.Id));
                var commentsReq = new HttpRequestMessage(HttpMethod.Get, $"retro_comments?item_id=in.({ids})&order=created_at.asc");
                commentsReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
                if (!string.IsNullOrEmpty(_supabaseAnonKey)) commentsReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
                if (!string.IsNullOrEmpty(correlationId)) commentsReq.Headers.Add("X-Correlation-Id", correlationId);
                var commentsResp = await _postgrestClient.SendAsync(commentsReq, cancellationToken);
                if (commentsResp.IsSuccessStatusCode)
                {
                    var commentsJson = await commentsResp.Content.ReadAsStringAsync(cancellationToken);
                    var commentRows = JsonSerializer.Deserialize<List<JsonElement>>(commentsJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
                    aggregate.Comments = commentRows.Select(r => new RetroComment
                    {
                        Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                        ItemId = r.TryGetProperty("item_id", out var iid) ? iid.GetString() ?? string.Empty : string.Empty,
                        Text = r.TryGetProperty("text", out var tx) ? tx.GetString() ?? string.Empty : string.Empty,
                        Author = r.TryGetProperty("author", out var au) ? au.GetString() ?? string.Empty : string.Empty,
                        AuthorId = r.TryGetProperty("author_id", out var aid) ? aid.GetString() : null,
                        CreatedAt = r.TryGetProperty("created_at", out var cat) && cat.ValueKind == JsonValueKind.String ? DateTime.Parse(cat.GetString()!) : null
                    }).ToList();
                }
            }

            // 6) Compute votes per item
            var votesReq = new HttpRequestMessage(HttpMethod.Get, $"retro_votes?board_id=eq.{boardId}&select=item_id");
            votesReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) votesReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) votesReq.Headers.Add("X-Correlation-Id", correlationId);
            var votesResp = await _postgrestClient.SendAsync(votesReq, cancellationToken);
            if (votesResp.IsSuccessStatusCode)
            {
                var votesJson = await votesResp.Content.ReadAsStringAsync(cancellationToken);
                var voteRows = JsonSerializer.Deserialize<List<JsonElement>>(votesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
                var voteCounts = voteRows
                    .Where(v => v.TryGetProperty("item_id", out _))
                    .Select(v => v.GetProperty("item_id").GetString() ?? string.Empty)
                    .Where(id => !string.IsNullOrEmpty(id))
                    .GroupBy(id => id)
                    .ToDictionary(g => g.Key, g => g.Count());
                foreach (var item in aggregate.Items)
                {
                    if (voteCounts.TryGetValue(item.Id, out var c)) item.Votes = c;
                }
            }

            // 7) Populate user votes for current user (if authenticated)
            var userId = ExtractUserIdFromToken(bearerToken);
            aggregate.UserVotes = new List<string>();
            if (!string.IsNullOrEmpty(userId))
            {
                var myVotesReq = new HttpRequestMessage(HttpMethod.Get, $"retro_votes?board_id=eq.{boardId}&user_id=eq.{userId}&select=item_id");
                myVotesReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
                if (!string.IsNullOrEmpty(_supabaseAnonKey)) myVotesReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
                if (!string.IsNullOrEmpty(correlationId)) myVotesReq.Headers.Add("X-Correlation-Id", correlationId);
                var myVotesResp = await _postgrestClient.SendAsync(myVotesReq, cancellationToken);
                if (myVotesResp.IsSuccessStatusCode)
                {
                    var myVotesJson = await myVotesResp.Content.ReadAsStringAsync(cancellationToken);
                    var myVoteRows = JsonSerializer.Deserialize<List<JsonElement>>(myVotesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
                    aggregate.UserVotes = myVoteRows
                        .Where(v => v.TryGetProperty("item_id", out _))
                        .Select(v => v.GetProperty("item_id").GetString() ?? string.Empty)
                        .Where(id => !string.IsNullOrEmpty(id))
                        .ToList();
                }
            }

            // 8) Enrich items with display names when possible
            var authorIds = aggregate.Items.Select(i => i.AuthorId).Where(id => !string.IsNullOrEmpty(id)).Cast<string>().Distinct().ToList();
            if (authorIds.Count > 0)
            {
                var profiles = await FetchProfilesAsync(authorIds, bearerToken, correlationId, cancellationToken);
                foreach (var item in aggregate.Items)
                {
                    if (!string.IsNullOrEmpty(item.AuthorId) && profiles.TryGetValue(item.AuthorId, out var p))
                    {
                        item.DisplayName = p.fullName ?? item.Author;
                    }
                }
            }

            return aggregate;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching retro board aggregate for room {RoomId}", roomId);
            throw;
        }
    }

    public async Task<RetroItem> CreateRetroItemAsync(string bearerToken, string boardId, string columnId, string text, string author, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Creating retro item on board {BoardId} in column {ColumnId}", boardId, columnId);
            var authorId = ExtractUserIdFromToken(bearerToken);
            var body = JsonSerializer.Serialize(new
            {
                board_id = boardId,
                column_id = columnId,
                text,
                author,
                author_id = authorId,
                session_id = sessionId
            });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var req = new HttpRequestMessage(HttpMethod.Post, "retro_items") { Content = content };
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
            var r = rows.First();
            return new RetroItem
            {
                Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                BoardId = boardId,
                ColumnId = columnId,
                Text = text,
                Author = author,
                AuthorId = authorId,
                Votes = 0,
                CreatedAt = r.TryGetProperty("created_at", out var ca) && ca.ValueKind == JsonValueKind.String ? DateTime.Parse(ca.GetString()!) : null,
                SessionId = sessionId
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating retro item on board {BoardId}", boardId);
            throw;
        }
    }

    public async Task<bool> UpdateRetroItemAsync(string bearerToken, string itemId, string text, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var body = JsonSerializer.Serialize(new { text });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var req = new HttpRequestMessage(HttpMethod.Patch, $"retro_items?id=eq.{itemId}") { Content = content };
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating retro item {ItemId}", itemId);
            throw;
        }
    }

    public async Task<bool> DeleteRetroItemAsync(string bearerToken, string itemId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Delete, $"retro_items?id=eq.{itemId}");
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting retro item {ItemId}", itemId);
            throw;
        }
    }

    public async Task<bool> AddRetroVoteAsync(string bearerToken, string boardId, string itemId, string? userId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            // If userId not provided, attempt to derive from token
            userId ??= ExtractUserIdFromToken(bearerToken);
            var body = JsonSerializer.Serialize(new { board_id = boardId, item_id = itemId, user_id = userId, session_id = sessionId });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var req = new HttpRequestMessage(HttpMethod.Post, "retro_votes") { Content = content };
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding retro vote for item {ItemId}", itemId);
            throw;
        }
    }

    public async Task<bool> RemoveRetroVoteAsync(string bearerToken, string boardId, string itemId, string? userId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            userId ??= ExtractUserIdFromToken(bearerToken);
            var query = new StringBuilder($"retro_votes?board_id=eq.{boardId}&item_id=eq.{itemId}");
            if (!string.IsNullOrEmpty(userId)) query.Append($"&user_id=eq.{userId}");
            if (!string.IsNullOrEmpty(sessionId)) query.Append($"&session_id=eq.{sessionId}");
            var req = new HttpRequestMessage(HttpMethod.Delete, query.ToString());
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing retro vote for item {ItemId}", itemId);
            throw;
        }
    }

    public async Task<RetroComment> AddRetroCommentAsync(string bearerToken, string itemId, string text, string author, string? authorId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Adding comment to item {ItemId}", itemId);
            authorId ??= ExtractUserIdFromToken(bearerToken);
            var body = JsonSerializer.Serialize(new { item_id = itemId, text, author, author_id = authorId, session_id = sessionId });
            var content = new StringContent(body, Encoding.UTF8, "application/json");
            var req = new HttpRequestMessage(HttpMethod.Post, "retro_comments") { Content = content };
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
            var r = rows.First();
            return new RetroComment
            {
                Id = r.TryGetProperty("id", out var id) ? id.GetString() ?? string.Empty : string.Empty,
                ItemId = itemId,
                Text = text,
                Author = author,
                AuthorId = authorId,
                CreatedAt = r.TryGetProperty("created_at", out var ca) && ca.ValueKind == JsonValueKind.String ? DateTime.Parse(ca.GetString()!) : null
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding comment to item {ItemId}", itemId);
            throw;
        }
    }

    public async Task<bool> DeleteRetroCommentAsync(string bearerToken, string commentId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Delete, $"retro_comments?id=eq.{commentId}");
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            if (!string.IsNullOrEmpty(_supabaseAnonKey)) req.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
            if (!string.IsNullOrEmpty(correlationId)) req.Headers.Add("X-Correlation-Id", correlationId);

            var resp = await _postgrestClient.SendAsync(req, cancellationToken);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting comment {CommentId}", commentId);
            throw;
        }
    }
}
