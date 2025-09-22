namespace Retroscope.Application.DTOs;

public class AdminSendNotificationRequest
{
    public List<Recipient> Recipients { get; set; } = new();
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Message { get; set; }
    public string? Url { get; set; }
}

public class Recipient
{
    public string? UserId { get; set; }
    public string? Email { get; set; }
}
