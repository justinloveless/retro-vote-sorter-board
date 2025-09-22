using System.Text.Json.Serialization;

namespace Retroscope.Application.DTOs;

public class MarkAllNotificationsReadRequest
{
    [JsonPropertyName("is_read")]
    public bool IsRead { get; set; } = true;
}
