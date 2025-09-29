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
        var response = new AdminSendNotificationResponse { Success = true, Count = request.Recipients.Count };
        return Task.FromResult(response);
    }

    public Task<MarkNotificationReadResponse> MarkNotificationReadAsync(string bearerToken, string notificationId, MarkNotificationReadRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var response = new MarkNotificationReadResponse
        {
            Success = true,
            Message = "Notification marked as read"
        };
        return Task.FromResult(response);
    }

    public Task<MarkAllNotificationsReadResponse> MarkAllNotificationsReadAsync(string bearerToken, MarkAllNotificationsReadRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var response = new MarkAllNotificationsReadResponse
        {
            Success = true,
            UpdatedCount = 5, // Mock value
            Message = "All notifications marked as read"
        };
        return Task.FromResult(response);
    }

    // Phase 3: Teams mocks
    public Task<TeamsResponse> GetTeamsAsync(string bearerToken, bool includeAll = false, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var response = new TeamsResponse
        {
            Items = new List<TeamItem>
            {
                new() { Id = "team-1", Name = "Alpha", CreaterId = "owner-1", CreatedAt = DateTime.UtcNow.AddDays(-10) },
                new() { Id = "team-2", Name = "Beta", CreaterId = "owner-2", CreatedAt = DateTime.UtcNow.AddDays(-5) }
            }
        };
        return Task.FromResult(response);
    }

    public Task<TeamDetailsResponse> GetTeamByIdAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var response = new TeamDetailsResponse
        {
            Team = new TeamItem { Id = teamId, Name = $"Team {teamId}", CreaterId = "owner-1", CreatedAt = DateTime.UtcNow.AddDays(-7) },
            Members = new List<TeamMemberItem>
            {
                new() { TeamId = teamId, UserId = "user1", DisplayName = "Mock User 1", Email = "user1@example.com", Role = "admin" },
                new() { TeamId = teamId, UserId = "user2", DisplayName = "Mock User 2", Email = "user2@example.com", Role = "member" }
            }
        };
        return Task.FromResult(response);
    }

    public Task<TeamItem> CreateTeamAsync(string bearerToken, CreateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var created = new TeamItem { Id = Guid.NewGuid().ToString(), Name = request.Name, CreaterId = "owner-1", CreatedAt = DateTime.UtcNow };
        return Task.FromResult(created);
    }

    public Task<TeamItem> UpdateTeamAsync(string bearerToken, string teamId, UpdateTeamRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var updated = new TeamItem { Id = teamId, Name = request.Name, CreaterId = "owner-1", CreatedAt = DateTime.UtcNow.AddDays(-3) };
        return Task.FromResult(updated);
    }

    public Task<bool> DeleteTeamAsync(string bearerToken, string teamId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    public Task<bool> AddMemberAsync(string bearerToken, string teamId, AddMemberRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    public Task<bool> UpdateMemberRoleAsync(string bearerToken, string teamId, string userId, UpdateMemberRoleRequest request, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    public Task<bool> RemoveMemberAsync(string bearerToken, string teamId, string userId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    // Phase 4: Retro mocks
    public Task<RetroBoardAggregateResponse> GetRetroBoardAsync(string bearerToken, string roomId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var board = new RetroBoardItem
        {
            Id = Guid.NewGuid().ToString(),
            RoomId = roomId,
            Title = "Mock Retro Board",
            RetroStage = "thinking",
            CreatedAt = DateTime.UtcNow
        };

        var response = new RetroBoardAggregateResponse
        {
            Board = board,
            Config = new { allow_anonymous = true, voting_enabled = true },
            Columns = new List<RetroColumnItem>
            {
                new() { Id = Guid.NewGuid().ToString(), BoardId = board.Id, Title = "Went Well", Position = 1, SortOrder = 1, IsActionItems = false },
                new() { Id = Guid.NewGuid().ToString(), BoardId = board.Id, Title = "To Improve", Position = 2, SortOrder = 2, IsActionItems = false }
            },
            Items = new List<RetroItem>(),
            Comments = new List<RetroComment>(),
            UserVotes = new List<string>()
        };

        return Task.FromResult(response);
    }

    public Task<RetroItem> CreateRetroItemAsync(string bearerToken, string boardId, string columnId, string text, string author, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var item = new RetroItem
        {
            Id = Guid.NewGuid().ToString(),
            BoardId = boardId,
            ColumnId = columnId,
            Text = text,
            Author = author,
            AuthorId = null,
            Votes = 0,
            CreatedAt = DateTime.UtcNow,
            SessionId = sessionId
        };
        return Task.FromResult(item);
    }

    public Task<bool> UpdateRetroItemAsync(string bearerToken, string itemId, string text, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    public Task<bool> DeleteRetroItemAsync(string bearerToken, string itemId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    public Task<bool> AddRetroVoteAsync(string bearerToken, string boardId, string itemId, string? userId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    public Task<bool> RemoveRetroVoteAsync(string bearerToken, string boardId, string itemId, string? userId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    public Task<RetroComment> AddRetroCommentAsync(string bearerToken, string itemId, string text, string author, string? authorId, string? sessionId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var comment = new RetroComment
        {
            Id = Guid.NewGuid().ToString(),
            ItemId = itemId,
            Text = text,
            Author = author,
            AuthorId = authorId,
            CreatedAt = DateTime.UtcNow
        };
        return Task.FromResult(comment);
    }

    public Task<bool> DeleteRetroCommentAsync(string bearerToken, string commentId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    // Feature Flags mocks
    public Task<FeatureFlagsResponse> GetFeatureFlagsAsync(string bearerToken, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var response = new FeatureFlagsResponse
        {
            Items = new List<FeatureFlagItem>
            {
                new() { FlagName = "retro.audio_summary", Description = "Enable AI audio summaries", IsEnabled = false },
                new() { FlagName = "retro.user_readiness", Description = "Enable readiness tracking", IsEnabled = true }
            }
        };
        return Task.FromResult(response);
    }

    public Task<bool> UpdateFeatureFlagAsync(string bearerToken, string flagName, bool isEnabled, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    public Task<AvatarUploadResponse> UploadAvatarAsync(string bearerToken, string userId, byte[] bytes, string contentType, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        var resp = new AvatarUploadResponse { PublicUrl = $"https://example.com/avatars/{userId}.png" };
        return Task.FromResult(resp);
    }

    public Task<string> GetAvatarPublicUrlAsync(string bearerToken, string userId, string? correlationId = null, CancellationToken cancellationToken = default)
    {
        return Task.FromResult($"https://example.com/avatars/{userId}.png");
    }
}
