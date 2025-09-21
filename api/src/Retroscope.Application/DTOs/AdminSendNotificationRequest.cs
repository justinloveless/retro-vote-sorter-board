namespace Retroscope.Application.DTOs;

public class AdminSendNotificationRequest
{
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public List<string> TargetUserIds { get; set; } = new();
}
