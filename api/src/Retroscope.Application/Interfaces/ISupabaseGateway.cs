using Retroscope.Application.DTOs;

namespace Retroscope.Application.Interfaces;

public interface ISupabaseGateway
{
    Task<NotificationsResponse> GetNotificationsAsync(string bearerToken, int limit, string? correlationId = null, CancellationToken cancellationToken = default);
    
    Task<TeamMembersResponse> GetTeamMembersAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default);
    
    Task<AdminSendNotificationResponse> AdminSendNotificationAsync(string authHeader, AdminSendNotificationRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
}
