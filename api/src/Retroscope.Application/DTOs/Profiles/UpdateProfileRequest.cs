namespace Retroscope.Application.DTOs.Profiles;

public sealed class UpdateProfileRequest
{
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? ThemePreference { get; set; }
    public object? BackgroundPreference { get; set; }
}

