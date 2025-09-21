namespace Retroscope.Application.DTOs;

public class NotificationItem
{
    public string Id { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public bool Read { get; set; }
}
