namespace Retroscope.Application.DTOs;

public class FeatureFlagItem
{
    public string FlagName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsEnabled { get; set; }
}

public class FeatureFlagsResponse
{
    public List<FeatureFlagItem> Items { get; set; } = new();
}


