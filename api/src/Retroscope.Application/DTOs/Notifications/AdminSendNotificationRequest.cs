using System.Text.Json.Serialization;

namespace Retroscope.Application.DTOs.Notifications;

public class AdminSendNotificationRequest
{
    [JsonPropertyName("recipients")]
    public List<Recipient> Recipients { get; set; } = new();
    
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;
    
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;
    
    [JsonPropertyName("message")]
    public string? Message { get; set; }
    
    [JsonPropertyName("url")]
    public string? Url { get; set; }
}

public class Recipient
{
    [JsonPropertyName("userId")]
    public string? UserId { get; set; }
    
    [JsonPropertyName("email")]
    public string? Email { get; set; }
}
