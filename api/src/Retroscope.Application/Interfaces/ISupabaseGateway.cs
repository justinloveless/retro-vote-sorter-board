using Retroscope.Application.DTOs;

namespace Retroscope.Application.Interfaces;

public interface ISupabaseGateway
{
    Task<NotificationsResponse> GetNotificationsAsync(string bearerToken, int limit, CancellationToken cancellationToken = default);
    
    Task<TeamMembersResponse> GetTeamMembersAsync(string bearerToken, string teamId, CancellationToken cancellationToken = default);
    
    Task<AdminSendNotificationResponse> AdminSendNotificationAsync(string authHeader, AdminSendNotificationRequest request, CancellationToken cancellationToken = default);
}
