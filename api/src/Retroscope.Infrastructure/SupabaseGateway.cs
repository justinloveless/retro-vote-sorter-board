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

    public SupabaseGateway(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<SupabaseGateway> logger)
    {
        _postgrestClient = httpClientFactory.CreateClient("PostgrestClient");
        _functionsClient = httpClientFactory.CreateClient("FunctionsClient");
        _logger = logger;

        // Configure base URLs from configuration
        var postgrestUrl = configuration["SUPABASE_POSTGREST_URL"];
        var functionsUrl = configuration["SUPABASE_FUNCTIONS_URL"];

        if (!string.IsNullOrEmpty(postgrestUrl))
        {
            _postgrestClient.BaseAddress = new Uri(postgrestUrl);
        }

        if (!string.IsNullOrEmpty(functionsUrl))
        {
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

            var request = new HttpRequestMessage(HttpMethod.Get, $"team_members?select=user_id,team_id,role,profiles(display_name,email)&team_id=eq.{teamId}");
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(bearerToken);
            
            if (!string.IsNullOrEmpty(correlationId))
            {
                request.Headers.Add("X-Correlation-Id", correlationId);
            }

            var response = await _postgrestClient.SendAsync(request, cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch team members. Status: {StatusCode}", response.StatusCode);
                throw new HttpException(response.StatusCode, $"Supabase request failed with status {response.StatusCode}");
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var rawData = JsonSerializer.Deserialize<List<JsonElement>>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? new List<JsonElement>();

            var teamMembers = new List<TeamMemberItem>();
            foreach (var item in rawData)
            {
                var teamMember = new TeamMemberItem
                {
                    TeamId = item.GetProperty("team_id").GetString() ?? "",
                    UserId = item.GetProperty("user_id").GetString() ?? "",
                    Role = item.GetProperty("role").GetString() ?? "",
                };

                if (item.TryGetProperty("profiles", out var profiles) && profiles.ValueKind == JsonValueKind.Object)
                {
                    teamMember.DisplayName = profiles.GetProperty("display_name").GetString() ?? "";
                    teamMember.Email = profiles.GetProperty("email").GetString() ?? "";
                }

                teamMembers.Add(teamMember);
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
            _logger.LogInformation("Sending admin notification to {UserCount} users", request.TargetUserIds.Count);

            var json = JsonSerializer.Serialize(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, "admin-send-notification")
            {
                Content = content
            };
            httpRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(authHeader);
            
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
            }) ?? new AdminSendNotificationResponse { Status = "queued" };

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending admin notification");
            throw;
        }
    }
}
