using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;

namespace Retroscope.Api.Services;

public class MockSupabaseGateway : ISupabaseGateway
{
    public Task<NotificationsResponse> GetNotificationsAsync(string bearerToken, int limit, CancellationToken cancellationToken = default)
    {
        var response = new NotificationsResponse
        {
            Items = new List<NotificationItem>
            {
                new() { Id = "1", CreatedAt = DateTime.UtcNow, Type = "info", Title = "Test", Body = "Test body", Read = false }
            }
        };
        return Task.FromResult(response);
    }

    public Task<TeamMembersResponse> GetTeamMembersAsync(string bearerToken, string teamId, CancellationToken cancellationToken = default)
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

    public Task<AdminSendNotificationResponse> AdminSendNotificationAsync(string authHeader, AdminSendNotificationRequest request, CancellationToken cancellationToken = default)
    {
        var response = new AdminSendNotificationResponse { Status = "queued" };
        return Task.FromResult(response);
    }
}