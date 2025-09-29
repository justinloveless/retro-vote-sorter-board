using System.Text.Json.Serialization;

namespace Retroscope.Application.DTOs.Notifications;

public class NotificationItem
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("user_id")]
    public string UserId { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    // Supabase column is `message`
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    // Optional navigation URL stored in supabase
    [JsonPropertyName("url")]
    public string? Url { get; set; }

    // Supabase column is `is_read`
    [JsonPropertyName("is_read")]
    public bool IsRead { get; set; }

    // Supabase column is `created_at`
    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }
}
