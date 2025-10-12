using Microsoft.EntityFrameworkCore;
using Retroscope.Application.DTOs.Notifications;

namespace Retroscope.Infrastructure.Postgres;

public partial class PostgresGateway
{
    public async Task<NotificationsResponse> GetNotificationsAsync(
        string bearerToken,
        int limit,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        var userId = ExtractUserIdFromToken(bearerToken);
        if (string.IsNullOrEmpty(userId))
        {
            throw new UnauthorizedAccessException("Invalid bearer token");
        }

        // Set RLS context
        await SetRLSContextAsync(userId);

        // Query with RLS automatically applied
        var notifications = await _context.Notifications
            .OrderByDescending(n => n.CreatedAt)
            .Take(limit)
            .Select(n => new NotificationItem
            {
                Id = n.Id.ToString(),
                UserId = n.UserId.ToString(),
                Type = n.Type,
                Title = n.Title,
                Message = n.Message,
                Url = n.Url,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync(cancellationToken);

        _logger.LogInformation("Retrieved {Count} notifications for user {UserId}", notifications.Count, userId);

        return new NotificationsResponse { Items = notifications };
    }

    public async Task<AdminSendNotificationResponse> AdminSendNotificationAsync(
        string authHeader,
        AdminSendNotificationRequest request,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        var userId = ExtractUserIdFromToken(authHeader);
        if (string.IsNullOrEmpty(userId))
        {
            throw new UnauthorizedAccessException("Invalid bearer token");
        }

        // Set RLS context
        await SetRLSContextAsync(userId);

        // Check if user is admin (this would be validated by RLS policies)
        var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.Id == Guid.Parse(userId), cancellationToken);
        if (profile?.Role != "admin")
        {
            throw new UnauthorizedAccessException("User must be admin to send notifications");
        }

        // Create notifications for each target user
        foreach (var targetUserId in request.TargetUserIds)
        {
            var notification = new Entities.Notification
            {
                Id = Guid.NewGuid(),
                UserId = Guid.Parse(targetUserId),
                Type = "admin_notification",
                Title = request.Title,
                Message = request.Body,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.Notifications.Add(notification);
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Admin {UserId} sent notifications to {Count} users", userId, request.TargetUserIds.Count);

        return new AdminSendNotificationResponse { Status = "queued" };
    }

    public async Task<MarkNotificationReadResponse> MarkNotificationReadAsync(
        string bearerToken,
        string notificationId,
        MarkNotificationReadRequest request,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        var userId = ExtractUserIdFromToken(bearerToken);
        if (string.IsNullOrEmpty(userId))
        {
            throw new UnauthorizedAccessException("Invalid bearer token");
        }

        // Set RLS context
        await SetRLSContextAsync(userId);

        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == Guid.Parse(notificationId), cancellationToken);

        if (notification == null)
        {
            throw new KeyNotFoundException($"Notification {notificationId} not found");
        }

        notification.IsRead = request.IsRead;
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Marked notification {NotificationId} as read={IsRead} for user {UserId}", 
            notificationId, request.IsRead, userId);

        return new MarkNotificationReadResponse { Success = true };
    }

    public async Task<MarkAllNotificationsReadResponse> MarkAllNotificationsReadAsync(
        string bearerToken,
        MarkAllNotificationsReadRequest request,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        var userId = ExtractUserIdFromToken(bearerToken);
        if (string.IsNullOrEmpty(userId))
        {
            throw new UnauthorizedAccessException("Invalid bearer token");
        }

        // Set RLS context
        await SetRLSContextAsync(userId);

        // RLS will automatically filter to user's notifications
        var count = await _context.Notifications
            .Where(n => !n.IsRead)
            .ExecuteUpdateAsync(
                n => n.SetProperty(x => x.IsRead, true),
                cancellationToken);

        _logger.LogInformation("Marked {Count} notifications as read for user {UserId}", count, userId);

        return new MarkAllNotificationsReadResponse { Success = true, Count = count };
    }
}

