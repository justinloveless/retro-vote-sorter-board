using Retroscope.Application.DTOs;

namespace Retroscope.Application.Interfaces;

public interface ISupabaseGateway
{
    Task<NotificationsResponse> GetNotificationsAsync(string bearerToken, int limit, string? correlationId = null, CancellationToken cancellationToken = default);

    Task<TeamMembersResponse> GetTeamMembersAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default);

    Task<AdminSendNotificationResponse> AdminSendNotificationAsync(string authHeader, AdminSendNotificationRequest request, string? correlationId = null, CancellationToken cancellationToken = default);

    Task<MarkNotificationReadResponse> MarkNotificationReadAsync(string bearerToken, string notificationId, MarkNotificationReadRequest request, string? correlationId = null, CancellationToken cancellationToken = default);

    Task<MarkAllNotificationsReadResponse> MarkAllNotificationsReadAsync(string bearerToken, MarkAllNotificationsReadRequest request, string? correlationId = null, CancellationToken cancellationToken = default);

    // Teams (Phase 3)
    Task<TeamsResponse> GetTeamsAsync(string bearerToken, bool includeAll = false, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamDetailsResponse> GetTeamByIdAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamItem> CreateTeamAsync(string bearerToken, CreateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<TeamItem> UpdateTeamAsync(string bearerToken, string teamId, UpdateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> DeleteTeamAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default);

    // Team member writes
    Task<bool> AddMemberAsync(string bearerToken, string teamId, AddMemberRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> UpdateMemberRoleAsync(string bearerToken, string teamId, string userId, UpdateMemberRoleRequest request, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> RemoveMemberAsync(string bearerToken, string teamId, string userId, string? correlationId = null, CancellationToken cancellationToken = default);

    // Retro (Phase 4 - initial read/CRUD subset)
    Task<RetroBoardAggregateResponse> GetRetroBoardAsync(string bearerToken, string roomId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<RetroItem> CreateRetroItemAsync(string bearerToken, string boardId, string columnId, string text, string author, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> UpdateRetroItemAsync(string bearerToken, string itemId, string text, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> DeleteRetroItemAsync(string bearerToken, string itemId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> AddRetroVoteAsync(string bearerToken, string boardId, string itemId, string? userId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> RemoveRetroVoteAsync(string bearerToken, string boardId, string itemId, string? userId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<RetroComment> AddRetroCommentAsync(string bearerToken, string itemId, string text, string author, string? authorId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> DeleteRetroCommentAsync(string bearerToken, string commentId, string? correlationId = null, CancellationToken cancellationToken = default);

    // Feature Flags
    Task<FeatureFlagsResponse> GetFeatureFlagsAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default);
    Task<bool> UpdateFeatureFlagAsync(string bearerToken, string flagName, bool isEnabled, string? correlationId = null, CancellationToken cancellationToken = default);
}
