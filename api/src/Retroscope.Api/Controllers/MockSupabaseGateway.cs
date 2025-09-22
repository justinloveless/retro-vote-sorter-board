using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;

namespace Retroscope.Api.Controllers;

public class MockSupabaseGateway : ISupabaseGateway
{
    public Task<NotificationsResponse> GetNotificationsAsync(string bearerToken, int limit, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var response = new NotificationsResponse
        {
            Items = new List<NotificationItem>
            {
                new() { Id = "1", UserId = "test-user", CreatedAt = DateTime.UtcNow, Type = "info", Title = "Test", Message = "Test body", Url = "/notifications/1", IsRead = false }
            }
        };
        return Task.FromResult(response);
    }

    public Task<TeamMembersResponse> GetTeamMembersAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var response = new TeamMembersResponse
        {
            Items = new List<TeamMemberItem>
            {
                new() { TeamId = teamId, UserId = "user1", DisplayName = "John Doe", Email = "john@example.com", Role = "admin" },
                new() { TeamId = teamId, UserId = "user2", DisplayName = "Jane Smith", Email = "jane@example.com", Role = "member" }
            }
        };
        return Task.FromResult(response);
    }

    public Task<AdminSendNotificationResponse> AdminSendNotificationAsync(string authHeader, AdminSendNotificationRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var response = new AdminSendNotificationResponse { Status = "queued" };
        return Task.FromResult(response);
    }
}
