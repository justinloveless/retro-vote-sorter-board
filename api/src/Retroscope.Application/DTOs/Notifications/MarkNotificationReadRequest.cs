using System.Text.Json.Serialization;

namespace Retroscope.Application.DTOs.Notifications;

public class MarkNotificationReadRequest
{
    [JsonPropertyName("is_read")]
    public bool IsRead { get; set; } = true;
}
