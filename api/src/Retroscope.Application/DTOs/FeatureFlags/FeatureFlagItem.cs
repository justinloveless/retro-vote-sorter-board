namespace Retroscope.Application.DTOs.FeatureFlags;

public class FeatureFlagItem
{
    public string FlagName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsEnabled { get; set; }
}