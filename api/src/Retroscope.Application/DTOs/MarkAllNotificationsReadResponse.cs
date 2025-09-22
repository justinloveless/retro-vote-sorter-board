using System.Text.Json.Serialization;

namespace Retroscope.Application.DTOs;

public class MarkAllNotificationsReadResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("updated_count")]
    public int UpdatedCount { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;
}
