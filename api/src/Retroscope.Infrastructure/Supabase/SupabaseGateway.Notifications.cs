using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Retroscope.Application.DTOs;
using Retroscope.Application.DTOs.Notifications;

namespace Retroscope.Infrastructure.Supabase;

public partial class SupabaseGateway
{
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

            return new MarkAllNotificationsReadResponse
            {
                Success = true,
                UpdatedCount = 0,
                Message = "All notifications marked as read"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking all notifications as read");
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


