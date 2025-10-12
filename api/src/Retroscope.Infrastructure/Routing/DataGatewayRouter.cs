using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Retroscope.Application.DTOs.FeatureFlags;
using Retroscope.Application.DTOs.Notifications;
using Retroscope.Application.DTOs.Profiles;
using Retroscope.Application.DTOs.RetroBoard;
using Retroscope.Application.DTOs.RetroBoards;
using Retroscope.Application.DTOs.RetroComments;
using Retroscope.Application.DTOs.Storage;
using Retroscope.Application.DTOs.TeamInvitations;
using Retroscope.Application.DTOs.TeamMembers;
using Retroscope.Application.DTOs.Teams;
using Retroscope.Application.Interfaces;

namespace Retroscope.Infrastructure.Routing;

public class DataGatewayRouter : IDataGateway
{
    private readonly ISupabaseGateway _supabaseGateway;
    private readonly IPostgresGateway _postgresGateway;
    private readonly DualPathComparer _comparer;
    private readonly ILogger<DataGatewayRouter> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public DataGatewayRouter(
        ISupabaseGateway supabaseGateway,
        IPostgresGateway postgresGateway,
        DualPathComparer comparer,
        ILogger<DataGatewayRouter> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _supabaseGateway = supabaseGateway;
        _postgresGateway = postgresGateway;
        _comparer = comparer;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    private (bool UseLocalPostgres, bool UseDualPath) GetRoutingHeaders()
    {
        var headers = _httpContextAccessor.HttpContext?.Request?.Headers;
        
        var useLocalPostgres = headers?["X-UseLocalPostgres"].FirstOrDefault() == "true";
        var useDualPath = headers?["X-DualPath"].FirstOrDefault() == "true";

        return (useLocalPostgres, useDualPath);
    }

    private async Task<T> RouteAsync<T>(
        string operation,
        Func<ISupabaseGateway, Task<T>> supabaseOperation,
        Func<IPostgresGateway, Task<T>> postgresOperation,
        string? correlationId)
    {
        var (useLocalPostgres, useDualPath) = GetRoutingHeaders();

        // Mode 1: Supabase only (default)
        if (!useLocalPostgres)
        {
            _logger.LogDebug("{Operation}: Routing to Supabase only", operation);
            return await supabaseOperation(_supabaseGateway);
        }

        // Mode 2: Local Postgres only
        if (!useDualPath)
        {
            _logger.LogDebug("{Operation}: Routing to local Postgres only", operation);
            return await postgresOperation(_postgresGateway);
        }

        // Mode 3: Dual-path (both, use Supabase as primary)
        _logger.LogInformation("{Operation}: Dual-path mode enabled", operation);

        var sw1 = Stopwatch.StartNew();
        var supabaseTask = supabaseOperation(_supabaseGateway);

        var sw2 = Stopwatch.StartNew();
        var postgresTask = postgresOperation(_postgresGateway);

        try
        {
            await Task.WhenAll(supabaseTask, postgresTask);
            sw1.Stop();
            sw2.Stop();

            var supabaseResult = await supabaseTask;
            var postgresResult = await postgresTask;

            _comparer.LogTiming(operation, sw1.ElapsedMilliseconds, sw2.ElapsedMilliseconds, correlationId);
            _comparer.LogDifferences(operation, supabaseResult, postgresResult, correlationId);

            return supabaseResult; // Use Supabase as primary per plan
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{Operation}: Dual-path execution failed", operation);
            
            // If one succeeded, use it
            if (supabaseTask.IsCompletedSuccessfully)
            {
                _logger.LogWarning("{Operation}: Postgres failed, using Supabase result", operation);
                return await supabaseTask;
            }
            
            if (postgresTask.IsCompletedSuccessfully)
            {
                _logger.LogWarning("{Operation}: Supabase failed, using Postgres result", operation);
                return await postgresTask;
            }

            throw;
        }
    }

    #region Notifications
    public Task<NotificationsResponse> GetNotificationsAsync(string bearerToken, int limit, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetNotificationsAsync),
            sb => sb.GetNotificationsAsync(bearerToken, limit, correlationId, cancellationToken),
            pg => pg.GetNotificationsAsync(bearerToken, limit, correlationId, cancellationToken),
            correlationId);

    public Task<AdminSendNotificationResponse> AdminSendNotificationAsync(string authHeader, AdminSendNotificationRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(AdminSendNotificationAsync),
            sb => sb.AdminSendNotificationAsync(authHeader, request, correlationId, cancellationToken),
            pg => pg.AdminSendNotificationAsync(authHeader, request, correlationId, cancellationToken),
            correlationId);

    public Task<MarkNotificationReadResponse> MarkNotificationReadAsync(string bearerToken, string notificationId, MarkNotificationReadRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(MarkNotificationReadAsync),
            sb => sb.MarkNotificationReadAsync(bearerToken, notificationId, request, correlationId, cancellationToken),
            pg => pg.MarkNotificationReadAsync(bearerToken, notificationId, request, correlationId, cancellationToken),
            correlationId);

    public Task<MarkAllNotificationsReadResponse> MarkAllNotificationsReadAsync(string bearerToken, MarkAllNotificationsReadRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(MarkAllNotificationsReadAsync),
            sb => sb.MarkAllNotificationsReadAsync(bearerToken, request, correlationId, cancellationToken),
            pg => pg.MarkAllNotificationsReadAsync(bearerToken, request, correlationId, cancellationToken),
            correlationId);
    #endregion

    #region Teams
    public Task<TeamsResponse> GetTeamsAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetTeamsAsync),
            sb => sb.GetTeamsAsync(bearerToken, correlationId, cancellationToken),
            pg => pg.GetTeamsAsync(bearerToken, correlationId, cancellationToken),
            correlationId);

    public Task<TeamDetailsResponse> GetTeamAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetTeamAsync),
            sb => sb.GetTeamAsync(bearerToken, teamId, correlationId, cancellationToken),
            pg => pg.GetTeamAsync(bearerToken, teamId, correlationId, cancellationToken),
            correlationId);

    public Task<TeamItem> CreateTeamAsync(string bearerToken, CreateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(CreateTeamAsync),
            sb => sb.CreateTeamAsync(bearerToken, request, correlationId, cancellationToken),
            pg => pg.CreateTeamAsync(bearerToken, request, correlationId, cancellationToken),
            correlationId);

    public Task<TeamItem> UpdateTeamAsync(string bearerToken, string teamId, UpdateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(UpdateTeamAsync),
            sb => sb.UpdateTeamAsync(bearerToken, teamId, request, correlationId, cancellationToken),
            pg => pg.UpdateTeamAsync(bearerToken, teamId, request, correlationId, cancellationToken),
            correlationId);

    public Task DeleteTeamAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(DeleteTeamAsync),
            sb => sb.DeleteTeamAsync(bearerToken, teamId, correlationId, cancellationToken),
            pg => pg.DeleteTeamAsync(bearerToken, teamId, correlationId, cancellationToken),
            correlationId);

    public Task<TeamMembersResponse> GetTeamMembersAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetTeamMembersAsync),
            sb => sb.GetTeamMembersAsync(bearerToken, teamId, correlationId, cancellationToken),
            pg => pg.GetTeamMembersAsync(bearerToken, teamId, correlationId, cancellationToken),
            correlationId);

    public Task<TeamMemberItem> AddTeamMemberAsync(string bearerToken, string teamId, AddMemberRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(AddTeamMemberAsync),
            sb => sb.AddTeamMemberAsync(bearerToken, teamId, request, correlationId, cancellationToken),
            pg => pg.AddTeamMemberAsync(bearerToken, teamId, request, correlationId, cancellationToken),
            correlationId);

    public Task RemoveTeamMemberAsync(string bearerToken, string teamId, string userId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(RemoveTeamMemberAsync),
            sb => sb.RemoveTeamMemberAsync(bearerToken, teamId, userId, correlationId, cancellationToken),
            pg => pg.RemoveTeamMemberAsync(bearerToken, teamId, userId, correlationId, cancellationToken),
            correlationId);

    public Task<TeamMemberItem> UpdateTeamMemberRoleAsync(string bearerToken, string teamId, string userId, UpdateMemberRoleRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(UpdateTeamMemberRoleAsync),
            sb => sb.UpdateTeamMemberRoleAsync(bearerToken, teamId, userId, request, correlationId, cancellationToken),
            pg => pg.UpdateTeamMemberRoleAsync(bearerToken, teamId, userId, request, correlationId, cancellationToken),
            correlationId);

    public Task<TeamNameResponse> GetTeamNameAsync(string bearerToken, TeamNameRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetTeamNameAsync),
            sb => sb.GetTeamNameAsync(bearerToken, request, correlationId, cancellationToken),
            pg => pg.GetTeamNameAsync(bearerToken, request, correlationId, cancellationToken),
            correlationId);
    #endregion

    #region Profiles
    public Task<ProfileResponse> GetProfileAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetProfileAsync),
            sb => sb.GetProfileAsync(bearerToken, correlationId, cancellationToken),
            pg => pg.GetProfileAsync(bearerToken, correlationId, cancellationToken),
            correlationId);

    public Task<ProfileResponse> UpdateProfileAsync(string bearerToken, UpdateProfileRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(UpdateProfileAsync),
            sb => sb.UpdateProfileAsync(bearerToken, request, correlationId, cancellationToken),
            pg => pg.UpdateProfileAsync(bearerToken, request, correlationId, cancellationToken),
            correlationId);

    public Task<ProfilesResponse> GetProfilesAsync(string bearerToken, List<string> userIds, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetProfilesAsync),
            sb => sb.GetProfilesAsync(bearerToken, userIds, correlationId, cancellationToken),
            pg => pg.GetProfilesAsync(bearerToken, userIds, correlationId, cancellationToken),
            correlationId);
    #endregion

    #region RetroBoards
    public Task<RetroBoardsResponse> GetRetroBoardsAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetRetroBoardsAsync),
            sb => sb.GetRetroBoardsAsync(bearerToken, teamId, correlationId, cancellationToken),
            pg => pg.GetRetroBoardsAsync(bearerToken, teamId, correlationId, cancellationToken),
            correlationId);

    public Task<RetroBoardItem> GetRetroBoardAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetRetroBoardAsync),
            sb => sb.GetRetroBoardAsync(bearerToken, boardId, correlationId, cancellationToken),
            pg => pg.GetRetroBoardAsync(bearerToken, boardId, correlationId, cancellationToken),
            correlationId);

    public Task<RetroBoardItem> CreateRetroBoardAsync(string bearerToken, CreateRetroBoardRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(CreateRetroBoardAsync),
            sb => sb.CreateRetroBoardAsync(bearerToken, request, correlationId, cancellationToken),
            pg => pg.CreateRetroBoardAsync(bearerToken, request, correlationId, cancellationToken),
            correlationId);

    public Task<RetroBoardItem> UpdateRetroBoardAsync(string bearerToken, string boardId, UpdateRetroBoardRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(UpdateRetroBoardAsync),
            sb => sb.UpdateRetroBoardAsync(bearerToken, boardId, request, correlationId, cancellationToken),
            pg => pg.UpdateRetroBoardAsync(bearerToken, boardId, request, correlationId, cancellationToken),
            correlationId);

    public Task DeleteRetroBoardAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(DeleteRetroBoardAsync),
            sb => sb.DeleteRetroBoardAsync(bearerToken, boardId, correlationId, cancellationToken),
            pg => pg.DeleteRetroBoardAsync(bearerToken, boardId, correlationId, cancellationToken),
            correlationId);

    public Task<BoardTitlesResponse> GetBoardTitlesAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetBoardTitlesAsync),
            sb => sb.GetBoardTitlesAsync(bearerToken, teamId, correlationId, cancellationToken),
            pg => pg.GetBoardTitlesAsync(bearerToken, teamId, correlationId, cancellationToken),
            correlationId);

    public Task<RetroBoardSummaryResponse> GetRetroBoardSummaryAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetRetroBoardSummaryAsync),
            sb => sb.GetRetroBoardSummaryAsync(bearerToken, boardId, correlationId, cancellationToken),
            pg => pg.GetRetroBoardSummaryAsync(bearerToken, boardId, correlationId, cancellationToken),
            correlationId);
    #endregion

    #region Retro
    public Task<RetroBoardAggregateResponse> GetRetroBoardAggregateAsync(string bearerToken, string boardId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetRetroBoardAggregateAsync),
            sb => sb.GetRetroBoardAggregateAsync(bearerToken, boardId, correlationId, cancellationToken),
            pg => pg.GetRetroBoardAggregateAsync(bearerToken, boardId, correlationId, cancellationToken),
            correlationId);
    #endregion

    #region RetroComments
    public Task<RetroCommentsResponse> GetRetroCommentsAsync(string bearerToken, string itemId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetRetroCommentsAsync),
            sb => sb.GetRetroCommentsAsync(bearerToken, itemId, correlationId, cancellationToken),
            pg => pg.GetRetroCommentsAsync(bearerToken, itemId, correlationId, cancellationToken),
            correlationId);

    public Task<RetroCommentItem> CreateRetroCommentAsync(string bearerToken, CreateRetroCommentRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(CreateRetroCommentAsync),
            sb => sb.CreateRetroCommentAsync(bearerToken, request, correlationId, cancellationToken),
            pg => pg.CreateRetroCommentAsync(bearerToken, request, correlationId, cancellationToken),
            correlationId);
    #endregion

    #region TeamInvitations
    public Task<TeamInvitationsResponse> GetTeamInvitationsAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetTeamInvitationsAsync),
            sb => sb.GetTeamInvitationsAsync(bearerToken, teamId, correlationId, cancellationToken),
            pg => pg.GetTeamInvitationsAsync(bearerToken, teamId, correlationId, cancellationToken),
            correlationId);

    public Task<TeamInvitationItem> CreateTeamInvitationAsync(string bearerToken, CreateTeamInvitationRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(CreateTeamInvitationAsync),
            sb => sb.CreateTeamInvitationAsync(bearerToken, request, correlationId, cancellationToken),
            pg => pg.CreateTeamInvitationAsync(bearerToken, request, correlationId, cancellationToken),
            correlationId);

    public Task<TeamInvitationItem> UpdateTeamInvitationAsync(string bearerToken, string invitationId, UpdateTeamInvitationRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(UpdateTeamInvitationAsync),
            sb => sb.UpdateTeamInvitationAsync(bearerToken, invitationId, request, correlationId, cancellationToken),
            pg => pg.UpdateTeamInvitationAsync(bearerToken, invitationId, request, correlationId, cancellationToken),
            correlationId);
    #endregion

    #region Storage
    public Task<string> UploadAvatarAsync(string bearerToken, AvatarUpload upload, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(UploadAvatarAsync),
            sb => sb.UploadAvatarAsync(bearerToken, upload, correlationId, cancellationToken),
            pg => pg.UploadAvatarAsync(bearerToken, upload, correlationId, cancellationToken),
            correlationId);

    public Task<string> GetAvatarUrlAsync(string bearerToken, string userId, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetAvatarUrlAsync),
            sb => sb.GetAvatarUrlAsync(bearerToken, userId, correlationId, cancellationToken),
            pg => pg.GetAvatarUrlAsync(bearerToken, userId, correlationId, cancellationToken),
            correlationId);
    #endregion

    #region FeatureFlags
    public Task<FeatureFlagsResponse> GetFeatureFlagsAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default)
        => RouteAsync(
            nameof(GetFeatureFlagsAsync),
            sb => sb.GetFeatureFlagsAsync(bearerToken, correlationId, cancellationToken),
            pg => pg.GetFeatureFlagsAsync(bearerToken, correlationId, cancellationToken),
            correlationId);
    #endregion
}

