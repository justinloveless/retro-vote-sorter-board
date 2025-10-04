namespace Retroscope.Application.DTOs.Profiles;

public sealed class ProfileItem
{
    public required string Id { get; init; }
    public string? FullName { get; init; }
    public string? AvatarUrl { get; init; }
    public string? Role { get; init; }
    public string? ThemePreference { get; init; }
    public object? BackgroundPreference { get; init; }
}

