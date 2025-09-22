using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text;

namespace Retroscope.Infrastructure;

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
            var membersReq = new HttpRequestMessage(HttpMethod.Get, $"team_members?select=user_id,team_id,role&team_id=eq.{teamId}");
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

            var userIds = memberRows.Select(r => r.GetProperty("user_id").GetString()).Where(id => !string.IsNullOrEmpty(id)).Cast<string>().Distinct().ToList();

            var idToProfile = new Dictionary<string, (string? displayName, string? email)>();
            if (userIds.Count > 0)
            {
                // Step 2: fetch profiles in bulk
                var inList = string.Join(',', userIds);
                var profilesReq = new HttpRequestMessage(HttpMethod.Get, $"profiles?select=id,display_name,email&id=in.({inList})");
                profilesReq.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
                if (!string.IsNullOrEmpty(_supabaseAnonKey))
                {
                    profilesReq.Headers.TryAddWithoutValidation("apikey", _supabaseAnonKey);
                }
                if (!string.IsNullOrEmpty(correlationId))
                {
                    profilesReq.Headers.Add("X-Correlation-Id", correlationId);
                }

                var profilesResp = await _postgrestClient.SendAsync(profilesReq, cancellationToken);
                if (profilesResp.IsSuccessStatusCode)
                {
                    var profilesJson = await profilesResp.Content.ReadAsStringAsync(cancellationToken);
                    var profileRows = JsonSerializer.Deserialize<List<JsonElement>>(profilesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                                       ?? new List<JsonElement>();
                    foreach (var p in profileRows)
                    {
                        var id = p.GetProperty("id").GetString();
                        if (!string.IsNullOrEmpty(id))
                        {
                            idToProfile[id] = (p.TryGetProperty("display_name", out var dn) ? dn.GetString() : null,
                                               p.TryGetProperty("email", out var em) ? em.GetString() : null);
                        }
                    }
                }
            }

            var teamMembers = new List<TeamMemberItem>();
            foreach (var row in memberRows)
            {
                var uid = row.GetProperty("user_id").GetString() ?? "";
                idToProfile.TryGetValue(uid, out var prof);
                teamMembers.Add(new TeamMemberItem
                {
                    TeamId = row.GetProperty("team_id").GetString() ?? "",
                    UserId = uid,
                    Role = row.GetProperty("role").GetString() ?? "",
                    DisplayName = prof.displayName ?? string.Empty,
                    Email = prof.email ?? string.Empty
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
}
