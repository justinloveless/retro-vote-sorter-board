using System.Text.Json.Serialization;

namespace Retroscope.Application.DTOs.Notifications;

public class MarkNotificationReadResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;
}
